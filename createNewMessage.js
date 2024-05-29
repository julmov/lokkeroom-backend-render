import pool from "./db.js";

export const createNewMessage = async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).send({ error: "Content is required" });
  }

  try {
    await pool.query(
      "INSERT INTO messages (content, user_id) VALUES ($1, $2)",
      [content, req.user.id]
    );
    res.json({ msg: "Message has been sent" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ err: "Internal server error" });
  }
};
