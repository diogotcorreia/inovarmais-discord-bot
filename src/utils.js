const compareAttachments = (discord, inovar) => {
  if (discord.size !== inovar.length) return false;

  const ids = inovar.map((v) => v.id);

  return discord.every(
    (attachment) => ids.indexOf(attachment.name.split("_")[0]) >= 0
  );
};

module.exports = {
  compareAttachments,
};
