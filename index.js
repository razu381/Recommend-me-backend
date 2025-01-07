const express = require("express");
require("dotenv").config();
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
    origin: ["http://localhost:5173"],
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
    await client.connect();
    // Get the database and collection on which to run the operation
    const database = client.db("recommendme");
    const queries = database.collection("queries");
    const recommendations = database.collection("recommendations");

    //get queries all and limited
    app.get("/queries", async (req, res) => {
      let limit = parseInt(req.query.limit) || 0;
      let result;
      if (limit > 0) {
        result = await queries.find().limit(limit).toArray();
      } else {
        result = await queries.find().toArray();
      }
      res.send(result);
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
