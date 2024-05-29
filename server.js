import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./db.js"; 
import { loginUser } from "./login.js";
import { registerUser } from "./register.js";
import { authenticateToken } from "./authMiddleware.js";
import { createNewMessage } from "./createNewMessage.js";
import { createLobby } from "./createLobby.js";

const app = express();

app.use(cors());

const port = 3000;

dotenv.config();

app.use(express.json());



app.get("/", async (req, res) => {
  res.send("hhelloo from online");
});

app.get("/test", async (req, res) => {
  const q = await pool.query("SELECT * from users");
  res.send(q);
});

app.post("/api/auth/login", loginUser);
app.post("/api/auth/register", registerUser);
app.use(authenticateToken); // Use the middleware for all routes below this line

// Add protected routes here
app.get("/protected", async (req, res) => {
  res.send("This is a protected route");
});

app.post("/api/messages/new", createNewMessage);

app.get("/api/messages", async (req, res) => {
  const messages = await pool.query("SELECT * FROM messages");
  res.send(messages.rows);
});

// Create lobby route
app.post("/api/createLobby", createLobby);

//ADD MESSAGES TO LOBBY
app.post("/api/lobby/:id", async (req, res) => {
  const { id: lobbyId } = req.params;
  const { id: user_id } = req.user;
  const { message_content } = req.body;
  const timestamp = new Date();
  if (!message_content) {
    return res
      .status(400)
      .json({ error: "User ID and message content are required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO messages (lobby_id, user_id, message_content, timestamp) VALUES ($1, $2, $3, NOW()) RETURNING *",
      [lobbyId, user_id, message_content]
    );

    const newMessage = result.rows[0];

    return res.status(201).json({ message: "New message added", newMessage });
  } catch (err) {
    console.error("Error adding message:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//An array containing all the message from the lobby

app.get("/api/lobby/:id", async (req, res) => {
  const { id: lobbyId } = req.params;
  const { id: user_id } = req.user;

  try {
    const result = await pool.query(
      "SELECT message_content FROM messages WHERE lobby_id = $1 AND user_id = $2",
      [lobbyId, user_id]
    );

    const messages = result.rows.map((row) => row.message_content);

    return res.send(
      `Retrieving all messages for lobby with id ${lobbyId}: ${messages}`
    );
  } catch (err) {
    console.error("Error retrieving messages:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// EDIT MESSAGE
app.patch("/api/lobby/:messageId", async (req, res) => {
  const messageId = req.params.messageId;
  const { messagePatches } = req.body;
  const userId = req.user.id;

  if (!messagePatches) {
    return res.status(400).send({ error: "Message patches are required" });
  }

  try {
    const result = await pool.query(
      "SELECT user_id FROM messages WHERE id = $1",
      [messageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send({ error: "Message not found" });
    }

    const messageUserId = result.rows[0].user_id;

    if (userId !== messageUserId) {
      return res
        .status(403)
        .send({ error: "You are not authorized to edit this message" });
    }

    await pool.query("UPDATE messages SET message_content = $1 WHERE id = $2", [
      messagePatches,
      messageId,
    ]);

    res.send(`Successfully edited message with id ${messageId}`);
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// ADMIN CAN EDIT MESSAGES
app.patch("/api/lobbyAdmin/:messageId", async (req, res) => {
  const messageId = req.params.messageId;
  const { messagePatches } = req.body;
  const userId = req.user.id;

  if (!messagePatches) {
    return res.status(400).send({ error: "Message patches are required" });
  }

  try {
    const result = await pool.query(
      `SELECT m.user_id AS message_user_id, ml.is_admin AS lobby_admin 
       FROM messages m 
       JOIN message_lobbies ml ON m.lobby_id = ml.id 
       WHERE m.id = $1`,
      [messageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send({ error: "Message not found" });
    }

    const { message_user_id, lobby_admin } = result.rows[0];

    if (userId === message_user_id || lobby_admin) {
      await pool.query(
        "UPDATE messages SET message_content = $1 WHERE id = $2",
        [messagePatches, messageId]
      );

      res.send(`Successfully edited message with id ${messageId}`);
    } else {
      return res
        .status(403)
        .send({ error: "You are not authorized to edit this message" });
    }
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

//SEARCH SINGLE MESSAGE
app.get("/api/lobby/:lobbyId/:messageId", async (req, res) => {
  const { lobbyId, messageId } = req.params;

  try {
    const messageQuery = await pool.query(
      "SELECT * FROM messages WHERE id = $1 AND lobby_id = $2",
      [messageId, lobbyId]
    );

    if (messageQuery.rows.length === 0) {
      return res
        .status(404)
        .send({ error: "Message not found in the specified lobby" });
    }

    const message = messageQuery.rows[0];

    res.send({ message });
  } catch (error) {
    console.error("Error retrieving message:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// ADD USER TO LOBBY
app.post("/api/lobby/:lobbyId/add-user", async (req, res) => {
  const lobbyId = req.params.lobbyId;
  const { userToAdd } = req.body;

  try {
    // Check if the userToAdd exists in the users table
    const userQuery = await popoolol.query(
      "SELECT id FROM users WHERE id = $1",
      [userToAdd]
    );

    if (userQuery.rows.length === 0) {
      return res
        .status(404)
        .send({ error: "User not found or not registered" });
    }

    const isAdminQuery = await pool.query(
      "SELECT is_admin FROM message_lobbies WHERE id = $1 AND user_id = $2",
      [lobbyId, req.user.id]
    );

    if (isAdminQuery.rows.length === 0 || !isAdminQuery.rows[0].is_admin) {
      return res.status(403).send({ error: "Only lobby admins can add users" });
    }

    const existingUser = await pool.query(
      "SELECT * FROM user_lobbies WHERE lobby_id = $1 AND user_id = $2",
      [lobbyId, userToAdd]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .send({ error: "User already exists in the lobby" });
    }

    // Insert the userToAdd into the user_lobbies table
    await pool.query(
      "INSERT INTO user_lobbies (lobby_id, user_id) VALUES ($1, $2)",
      [lobbyId, userToAdd]
    );

    res.send(
      `Successfully added user ${userToAdd} to lobby with id ${lobbyId}`
    );
  } catch (error) {
    console.error("Error adding user to lobby:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

//ADMIN REMOVE USER
app.post("/api/lobby/:lobbyId/remove-user", async (req, res) => {
  const lobbyId = req.params.lobbyId;
  const { userToRemove } = req.body;

  try {
    const isAdminQuery = await pool.query(
      "SELECT is_admin FROM message_lobbies WHERE id = $1 AND user_id = $2",
      [lobbyId, req.user.id] // Assuming req.user.id is the current user's ID
    );

    if (isAdminQuery.rows.length === 0 || !isAdminQuery.rows[0].is_admin) {
      return res
        .status(403)
        .send({ error: "Only lobby admins can remove users" });
    }

    // Check if the userToRemove exists in the user_lobbies table for the specified lobby
    const existingUser = await pool.query(
      "SELECT * FROM user_lobbies WHERE lobby_id = $1 AND user_id = $2",
      [lobbyId, userToRemove]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).send({ error: "User not found in the lobby" });
    }

    await pool.query(
      "DELETE FROM user_lobbies WHERE lobby_id = $1 AND user_id = $2",
      [lobbyId, userToRemove]
    );

    res.send(
      `Successfully removed user ${userToRemove} from lobby with id ${lobbyId}`
    );
  } catch (error) {
    console.error("Error removing user from lobby:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// USER CAN DELETE OWN MESSAGES
app.delete("/api/messages/:messageId", async (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "SELECT ml.user_id, ml.is_admin FROM message_lobbies ml JOIN messages m ON ml.user_id = m.user_id WHERE m.id = $1",
      [messageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send({ error: "Message not found" });
    }

    const messageUserId = result.rows[0].user_id;
    const isAdmin = result.rows[0].is_admin;

    if (userId !== messageUserId && !isAdmin) {
      return res
        .status(403)
        .send({ error: "You are not authorized to delete this message" });
    }

    await pool.query("DELETE FROM messages WHERE id = $1", [messageId]);

    res.send(`Successfully deleted message with id ${messageId}`);
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

//DIRECT MESSAGES

app.post("/api/messages/send", async (req, res) => {
  const { senderId, receiverId, messageContent } = req.body;

  try {
    // Insert the message into the direct_messages table
    await pool.query(
      "INSERT INTO direct_messages (sender_id, receiver_id, message_content) VALUES ($1, $2, $3)",
      [senderId, receiverId, messageContent]
    );

    res.send({ success: true, message: "Direct message sent successfully" });
  } catch (error) {
    console.error("Error sending direct message:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

//RECEIVED MESSAGES
app.get("/api/messages/:senderId/:receiverId", async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    // Fetch direct messages between the sender and receiver
    const messages = await pool.query(
      "SELECT * FROM direct_messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp ASC",
      [senderId, receiverId]
    );

    res.send({ messages: messages.rows });
  } catch (error) {
    console.error("Error fetching direct messages:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});
//ALL LOBBIES

app.get("/api/lobbynames", async (req, res) => {
  const lobbbyNames = await pool.query("SELECT * FROM message_lobbies");
  res.send(lobbbyNames.rows);
});

app.get("/api/users", async (req, res) => {
  const usernames = await pool.query("SELECT * FROM users");
  res.send(usernames.rows);
});

///- Users can join multiple teams
//Implement a direct message system (user to user message)
//Try to implement Anti-bruteforce (ex: people cannot attempt more than 5 failed logins/hour)
//Admins can add people that have not yet registered to the platform.
app.get("/api/direct-messages", async (req, res) => {
  const { email } = req.user; // Assuming you have the email in req.user

  try {
    // First, find the user ID based on the email
    const userQuery = await pool.query(
      "SELECT id FROM public.users WHERE email = $1",
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user_id = userQuery.rows[0].id;

    // Now fetch the direct messages for the user using the user_id
    const result = await pool.query(
      "SELECT message_content FROM direct_messages WHERE receiver_id = $1",
      [user_id]
    );

    const messages = result.rows.map((row) => row.message_content);

    return res.send(
      `Retrieving direct messages for user with id ${user_id}: ${messages}`
    );
  } catch (err) {
    console.error("Error retrieving messages:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Example app listening on port ${port}`);
});
