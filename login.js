import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import pool from "./db.js"; // Adjust the path as necessary

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).send({ error: "Invalid request" });

  const q = await pool.query(
    "SELECT password, id, username from users WHERE email=$1",
    [email]
  );

  if (q.rowCount === 0) {
    return res.status(404).send({ error: "This user does not exist" });
  }

  const result = q.rows[0];
  const match = await bcrypt.compare(password, result.password);

  if (!match) {
    return res.status(403).send({ error: "Wrong password" });
  }

  try {
    const token = await JWT.sign(
      { id: result.id, username: result.username, email },
      process.env.JWT_SECRET,
      {
        algorithm: "HS512",
        expiresIn: "1h",
      }
    );

    return res.send({ token });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: "Cannot generate token" });
  }
};
