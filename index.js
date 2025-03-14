require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = 3000;

function verifyToken(req, res, next) {
  let token = req?.cookies.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.user = decoded;
    next();
  });
}

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://recommendme-35a11.web.app"],
    credentials: true,
  })
);
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@productrecommendation.xvz0e.mongodb.net/?retryWrites=true&w=majority&appName=productrecommendation`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    // Get the database and collection on which to run the operation
    const database = client.db("recommendme");
    const queries = database.collection("queries");
    const recommendations = database.collection("recommendations");

    //get queries all and limited
    app.get("/queries", async (req, res) => {
      try {
        let limit = parseInt(req.query.limit) || 0;

        let result;
        if (limit > 0) {
          result = await queries.find().limit(limit).toArray();
        } else {
          result = await queries.find().toArray();
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching query:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    //post queries
    app.post("/queries", verifyToken, async (req, res) => {
      let query = req.body.formData;
      if (query.email != req.user.email) {
        return res.status(401).send({ messege: "Unauthorized access" });
      }
      let result = await queries.insertOne(query);

      res.send(result);
    });
    //search queries
    app.get("/search", async (req, res) => {
      let query = req.query.q;
      let filter = {
        productName: { $regex: query, $options: "i" },
      };
      let result = await queries.find(filter).toArray();

      res.send(result);
    });

    //update queries
    app.put("/update-query/:id", async (req, res) => {
      let query = req.body;
      let filter = { _id: new ObjectId(req.params.id) };
      let updatedQuery = {
        $set: query,
      };
      let result = await queries.updateOne(filter, updatedQuery);
      res.send(result);
    });

    //delete query
    app.delete("/my-queries/:id", async (req, res) => {
      let id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      let result = await queries.deleteOne(filter);
      res.send(result);
    });

    //get single query
    app.get("/queries/:id", async (req, res) => {
      let id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      let result = await queries.findOne(filter);
      res.send(result);
    });

    //get queries according to user email
    app.post("/my-queries", verifyToken, async (req, res) => {
      let email = req.body;
      let query = email;
      //console.log(req.user.email, email.email);
      if (req.user.email != email.email) {
        return res.status(401).send({ messege: "Unauthorized access" });
      }
      let options = { sort: { date: -1 } };
      result = await queries.find(query, options).toArray();

      res.send(result);
    });

    // ------------Recommendations starts from here------------------
    //get all recommendations by query id
    app.get("/recommendations/:id", async (req, res) => {
      let queryId = req.params.id;
      let filter = { queryId: queryId };

      let result = await recommendations.find(filter).toArray();

      res.send(result);
    });
    //post recommendations
    app.post("/recommendations", async (req, res) => {
      let recommendation = req.body;
      let result = await recommendations.insertOne(recommendation);
      if (result.insertedId) {
        let queryFilter = { _id: new ObjectId(recommendation.queryId) };
        let update = { $inc: { recommendationCount: 1 } };

        let incrememntResult = await queries.updateOne(queryFilter, update);
      }

      res.send(result);
    });
    //get recommendations by me
    app.get("/recommended-by-me/:email", async (req, res) => {
      let email = req.params.email;
      let filter = { recommenderEmail: email };

      let result = await recommendations.find(filter).toArray();
      res.send(result);
    });
    //get others recommendations for me
    app.get("/recommended-for-me/:email", async (req, res) => {
      let email = req.params.email;
      let filter = { userEmail: email };

      let result = await recommendations.find(filter).toArray();
      res.send(result);
    });
    //delete recommendation
    app.delete("/recommendations/:id", async (req, res) => {
      let id = req.params.id;
      let filter = { _id: new ObjectId(id) };

      let recommendation = await recommendations.findOne(filter);

      let result = await recommendations.deleteOne(filter);

      //decrease the recommendation count
      if (result.deletedCount === 1) {
        let queryFilter = { _id: new ObjectId(recommendation.queryId) };
        let update = { $inc: { recommendationCount: -1 } };

        let decrememntResult = await queries.updateOne(queryFilter, update);
      }

      res.send(result);
    });

    // -------------------- JWT TOKEN ------------------
    app.post("/jwt", async (req, res) => {
      let email = req.body;
      //console.log(email);
      let token = jwt.sign(email, process.env.JWT_SECRET, { expiresIn: "1d" });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ success: true });
    });

    app.post("/deleteCookieOnLogOut", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ RemoveToken: true });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello My Recommendation!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
