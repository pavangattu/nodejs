const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server is Running at http://localhost:3000`);
    });
  } catch (e) {
    console.log(`DATA Base ERROR : ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const prevDbQuery = `SELECT * FROM user WHERE username='${username}'`;
  const prevDb = await db.get(prevDbQuery);

  if (prevDb !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashPassword = await bcrypt.hash(password, 10);
      const postQuery = `INSERT INTO user (username,password,name,gender) VALUES ('${username}','${hashPassword}','${name}','${gender}');`;
      await db.run(postQuery);
      response.send("User created successfully");
    }
  }
});

//

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const prevDbQuery = `SELECT * FROM user WHERE username='${username}'`;
  const prevDb = await db.get(prevDbQuery);

  if (prevDb === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePass = await bcrypt.compare(password, prevDb.password);
    if (comparePass === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "hellosomething");

      response.send({ jwtToken });
    }
  }
});

//

const authentication = (request, response, next) => {
  const getHeader = request.headers["authorization"];
  let token;
  if (getHeader !== undefined) {
    token = getHeader.split(" ")[1];
  }

  if (token === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(token, "hellosomething", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const getQuery = `SELECT user.username ,tweet.tweet,tweet.date_time FROM follower JOIN tweet ON follower.following_user_id=tweet.user_id JOIN user ON follower.follower_id=user.user_id  ORDER BY tweet.date_time DESC LIMIT 4`;
  const getResponse = await db.all(getQuery);
  response.send(getResponse);
});

//
app.get("/user/following/", authentication, async (request, response) => {
  const getQuery = `SELECT user.username as name FROM user JOIN follower ON user.user_id = follower.following_user_id Group by follower.following_user_id`;

  const getResponse = await db.all(getQuery);
  response.send(getResponse);
});

//

app.get("/user/followers/", authentication, async (request, response) => {
  const getQuery = `SELECT user.username as name FROM user JOIN follower ON user.user_id = follower.follower_user_id Group by follower.follower_user_id `;
  const getResponse = await db.all(getQuery);
  response.send(getResponse);
});

//

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;

  const getPrevQuery = `SELECT * FROM follower JOIN tweet ON follower.following_user_id = tweet.user_id WHERE follower.following_user_id=tweet.user_id`;
  const prevDB = await db.get(getPrevQuery);

  if (prevDB === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getQuery = `SELECT tweet.tweet,COUNT(like.like_id) as likes,COUNT(reply.reply_id) as replies,tweet.date_time as dateTime FROM tweet JOIN follower ON tweet.user_id = follower.follower_user_id JOIN reply ON tweet.tweet_id = reply.tweet_id  JOIN like on reply.tweet_id = like.tweet_id WHERE tweet.tweet_id='${tweetId}';`;
    const getResponse = await db.get(getQuery);
    response.send(getResponse);
  }
});

app.get("/user/tweets/", authentication, async (request, response) => {
  const getQuery = `SELECT tweet.tweet,COUNT(like.like_id) as likes,COUNT(reply.reply_id) as replies,tweet.date_time as dateTime FROM tweet JOIN follower ON tweet.user_id = follower.follower_user_id JOIN reply ON tweet.tweet_id = reply.tweet_id  JOIN like on reply.tweet_id = like.tweet_id`;
  const getResponse = await db.all(getQuery);
  response.send(getResponse);
});

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;

  const getPrevQuery = `SELECT * FROM follower JOIN tweet ON follower.following_user_id = tweet.user_id WHERE tweet.tweet_id=${tweetId}`;
  const prevDB = await db.get(getPrevQuery);

  if (prevDB === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `Delete From tweet where tweet_id=${tweetId}`;
    const getResponse = await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
