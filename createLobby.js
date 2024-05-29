import pool from "./db.js";

export const createLobby = async (req, res) => {
  const { lobby_name } = req.body;

  if (!lobby_name) {
    return res.status(400).json({ error: "Lobby name is required" });
  }

  const { id: user_id } = req.user;

  try {
    const result = await pool.query(
      "INSERT INTO message_lobbies (user_id, lobby_name) VALUES ($1, $2) RETURNING id, user_id, lobby_name, is_admin",
      [user_id, lobby_name]
    );

    const createdLobby = result.rows[0];
    return res.status(201).json(createdLobby);
  } catch (err) {
    console.error("Error creating lobby:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
