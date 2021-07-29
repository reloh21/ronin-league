const Discord = require("discord.js");

const { EMBED_COLOR_CHECK, EMBED_COLOR_ERROR, fetchTeamByGuildAndUserId, getQueueArray } = require("../utils");

const execute = async (message, queueSize) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const fetchedTeam = await fetchTeamByGuildAndUserId(message.guild.id, message.author.id);

  const queueArray = getQueueArray(queueSize, message.channel.id, message.guild.id, "teams");

  if (fetchedTeam == null) {
    wrongEmbed.setTitle(":x: You do not belong to a team!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (fetchedTeam.captain !== message.author.id) {
    wrongEmbed.setTitle(":x: You are not the captain!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (queueArray.length === 2) {
    wrongEmbed.setTitle(":x: You can't leave now!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (queueArray.length === 0) {
    wrongEmbed.setTitle(":x: You aren't in the queue!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (queueArray[0].name === fetchedTeam.name) {
    queueArray.splice(0, queueArray.length);

    correctEmbed.setTitle(`:white_check_mark: ${fetchedTeam.name} left the queue! 0/2`);

    message.channel.send(correctEmbed);
  } else {
    wrongEmbed.setTitle(":x: You aren't in the queue!");

    message.channel.send(wrongEmbed);
  }
};

module.exports = {
  name: "leave",
  description: "Leave the queue",
  execute,
};