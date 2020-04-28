exports.up = function (knex) {
  return knex.schema.createTable("attachments", (t) => {
    t.string("id", 15).unique();
    t.text("description").notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("attachments");
};
