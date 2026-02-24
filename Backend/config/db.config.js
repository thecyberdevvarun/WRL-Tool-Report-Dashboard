import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

// Config for Database 1
export const dbConfig1 = {
  user: process.env.DB_USER1,
  password: process.env.DB_PASSWORD1,
  server: process.env.DB_SERVER1,
  database: process.env.DB_NAME1,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Config for Database 2
export const dbConfig2 = {
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  server: process.env.DB_SERVER2,
  database: process.env.DB_NAME2,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Config for Database 3
export const dbConfig3 = {
  user: process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  server: process.env.DB_SERVER3,
  database: process.env.DB_NAME3,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Function to connect to any given config
const pools = new Map();

export const connectToDB = async (dbConfig) => {
  const key = `${dbConfig.server}_${dbConfig.database}`;

  if (pools.has(key)) {
    console.log(`Reusing pool: ${dbConfig.database}`);
    return pools.get(key);
  }

  try {
    const pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();

    pools.set(key, pool);

    console.log(`Connected to ${dbConfig.database} ---> ${dbConfig.server}`);

    return pool;
  } catch (err) {
    console.error(`? DB connection failed: ${dbConfig.database}`, err);
    throw err;
  }
};

export default sql;
