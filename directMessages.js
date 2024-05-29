app.get("/api/direct-messages", async (req, res) => {
  const { user_id } = req.user; // Assuming you have user_id in req.user

  try {
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
