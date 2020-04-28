process.env.TZ = "Europe/Lisbon";

const cron = require("node-cron");
const { Client, MessageEmbed, MessageAttachment } = require("discord.js");
const moment = require("moment");
const profilesConfig = require("../config/profiles.json");
const Profile = require("./Profile");
const { compareAttachments } = require("./utils");
const { getDescription, setDescription } = require("./Database");

if (!profilesConfig) {
  console.error("No profiles provided");
  process.exit(1);
}

moment.locale("pt");
const profiles = profilesConfig.map((profile) => new Profile(profile));
const owners = profilesConfig.map((profile) => profile.owner).flat();

const client = new Client();

const updateAllChannels = async ({ fetch = true } = {}) => {
  if (fetch) {
    await Promise.all(
      profiles.map(async (profile) => {
        await profile.updateSummaries();
        await profile.updateTasks();
      })
    );
  }

  const messagesByChannel = profiles.reduce((acc, profile) => {
    let result = { ...acc };

    profile.summaries.forEach((summary) => {
      if (!result[summary.channelId])
        result[summary.channelId] = { summaries: [], tasks: [] };

      result[summary.channelId].summaries.push(summary);
    });

    profile.tasks.forEach((task) => {
      if (!result[task.channelId])
        result[task.channelId] = { summaries: [], tasks: [] };

      result[task.channelId].tasks.push(task);
    });

    return result;
  }, {});

  Object.keys(messagesByChannel).forEach((id) =>
    updateChannel(id, messagesByChannel[id])
  );
};

const updateChannel = async (channelId, { summaries, tasks }) => {
  const channel = await client.channels.fetch(channelId);
  const messages = await channel.messages
    .fetch()
    .then((msgs) =>
      msgs.filter(
        (msg) =>
          msg.author.id === client.user.id &&
          !!msg.embeds &&
          msg.embeds.length > 0
      )
    );

  const summariesPromise = summaries.map(async (summary) => {
    const embed = new MessageEmbed()
      .setTitle(`Aula nº ${summary.number}`)
      .setDescription(summary.description)
      .setColor(0x4298f5)
      .setAuthor(summary.subject)
      .addFields(
        await Promise.all(
          summary.attachments.map(async (attachment) => ({
            name: `(${attachment.id}) ${attachment.name}`.substring(0, 256),
            value: (await getDescription(attachment.id)) || "*Sem descrição*",
          }))
        )
      )
      .setFooter(
        `${summary.subject} S#${summary.number} - ${moment(summary.date).format(
          "ddd, D MMMM YYYY"
        )}`
      );

    const message = messages.find((msg) =>
      msg.embeds[0].footer.text.startsWith(
        `${summary.subject} S#${summary.number}`
      )
    );

    if (message) {
      if (compareAttachments(message.attachments, summary.attachments)) {
        await message.edit({ embed });
        return null;
      } else {
        await message.delete();
      }
    }

    const attachments = await Promise.all(
      summary.attachments.map(async (attachment) => {
        const buffer = await summary.profile.getAttachment(attachment.request);
        if (!buffer) return null;
        return new MessageAttachment(
          buffer,
          `${attachment.id}_${attachment.name}`
        );
      })
    );

    return {
      embed,
      files: attachments.filter((attachment) => !!attachment),
    };
  });

  const tasksPromise = tasks.map(async (task) => {
    const embed = new MessageEmbed()
      .setTitle(task.title)
      .setDescription(task.description)
      .setColor(0xeb6134)
      .setAuthor(task.subject)
      .addFields(
        await Promise.all(
          task.attachments.map(async (attachment) => ({
            name: `(${attachment.id}) ${attachment.name}`.substring(0, 256),
            value: (await getDescription(attachment.id)) || "*Sem descrição*",
          }))
        )
      )
      .setFooter(
        `${task.subject} T#${task.id} - ${moment(task.date).format(
          "ddd, D MMMM YYYY"
        )}`
      );

    const message = messages.find((msg) =>
      msg.embeds[0].footer.text.startsWith(`${task.subject} T#${task.id}`)
    );

    if (message) {
      if (compareAttachments(message.attachments, task.attachments)) {
        await message.edit({ embed });
        return null;
      } else {
        await message.delete();
      }
    }

    const attachments = await Promise.all(
      task.attachments.map(async (attachment) => {
        const buffer = await task.profile.getAttachment(attachment.request);
        if (!buffer) return null;
        return new MessageAttachment(
          buffer,
          `${attachment.id}_${attachment.name}`
        );
      })
    );
    return {
      embed,
      files: attachments.filter((attachment) => !!attachment),
    };
  });

  (await Promise.all([...summariesPromise, ...tasksPromise]))
    .filter((msg) => !!msg)
    .reduce((p, msg) => p.then(() => channel.send(msg)), Promise.resolve());
};

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await updateAllChannels();
  cron.schedule("*/15 * * * *", () => updateAllChannels());
});

client.on("message", async (msg) => {
  if (msg.content === "ping") {
    msg.reply("Pong!");
  }
  if (msg.content && msg.content.startsWith("!im ")) {
    if (owners.indexOf(msg.author.id) < 0) {
      msg.reply("Não tens permissão para isso!");
      return;
    }
    try {
      const id = msg.content.split(" ")[1];
      const content = msg.content.replace(`!im ${id} `, "");
      await setDescription(id, content);
      await updateAllChannels({ fetch: false });
      await msg.reply("Descrição alterada!");
    } catch {
      msg.reply("Ocorreu um erro ao alterar a descrição do anexo :sob:");
    }
  }
});

client.login(process.env.TOKEN || "");
