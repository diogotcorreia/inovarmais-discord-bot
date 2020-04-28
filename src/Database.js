const knex = require("knex")(require("../knexfile.js"));

const getDescription = async (id) => {
  if (!id) return null;
  try {
    const result = await knex("attachments")
      .select("description")
      .where("id", id);
    if (result.length === 0) return null;
    return result[0].description;
  } catch {
    return null;
  }
};

const insertOrUpdate = (knex, tableName, data) => {
  const firstData = data[0] ? data[0] : data;
  return knex.raw(
    knex(tableName).insert(data).toQuery() +
      " ON DUPLICATE KEY UPDATE " +
      Object.getOwnPropertyNames(firstData)
        .map((field) => `${field}=VALUES(${field})`)
        .join(", ")
  );
};

const setDescription = (id, description) => {
  if (!id || !description) return Promise.reject();
  return insertOrUpdate(knex, "attachments", { id, description });
};

module.exports = {
  getDescription,
  setDescription,
};
