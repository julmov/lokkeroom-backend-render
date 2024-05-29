import bcrypt from "bcrypt";
import pool from "./db.js"; // Adjust the path as necessary

export const registerUser = async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !password || !username)
    return res.status(400).send({ error: "Invalid request" });

  try {
    const encryptedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password, username) VALUES ($1, $2, $3)",
      [email, encryptedPassword, username]
    );

    return res.send({ info: "User succesfully created" });
  } catch (err) {
    console.log(err);

    return res.status(500).send({ error: "Internal server error" });
  }
};
