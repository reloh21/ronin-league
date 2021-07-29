const Discord = require("discord.js");

const OngoingGamesTeamsSchema = require("../../../utils/schemas/ongoingGamesTeamsSchema");

const client = require("../../../utils/createClientInstance.js");

const TeamsCollection = require("../../../utils/schemas/teamsSchema");

const {
  EMBED_COLOR_CHECK,
  EMBED_COLOR_ERROR,
  EMBED_COLOR_WARNING,
  fetchTeamByGuildAndUserId,
  channelQueues,
  getQueueArray,
  shuffle,
  gameCount,
  fetchGamesTeams,
} = require("../utils");

const execute = async (message, queueSize) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const channelId = message.channel.id;

  const fetchedTeam = await fetchTeamByGuildAndUserId(message.guild.id, message.author.id);

  const queueArray = getQueueArray(queueSize, channelId, message.guild.id, "teams");

  if (fetchedTeam == null) {
    wrongEmbed.setTitle(":x: You don't belong to a team!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (fetchedTeam.captain !== message.author.id) {
    wrongEmbed.setTitle(":x: You are not the captain!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (queueArray[0]?.name === fetchedTeam.name) {
    wrongEmbed.setTitle(":x: You're already in the queue");

    message.channel.send(wrongEmbed);
    return;
  }

  if (
    channelQueues
      .filter((e) => e.queueType === "teams" && e.guildId === message.guild.id)
      .map((e) => e.players)
      .flat()
      .map((e) => e.name)
      .flat()
      .includes(fetchedTeam.name)
  ) {
    wrongEmbed.setTitle(":x: You're already queued in another channel!");

    message.channel.send(wrongEmbed);
    return;
  }

  const ongoingGames = await fetchGamesTeams(null, message.guild.id);

  if (
    ongoingGames
      .map((e) => [e.team1, e.team2])
      .flat()
      .map((e) => e.name)
      .includes(fetchedTeam.name)
  ) {
    wrongEmbed.setTitle(":x: Your team is in the middle of a game!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (fetchedTeam.members.length + 1 < queueSize / 2 || (fetchedTeam.members.length === 0 && queueSize !== 2)) {
    wrongEmbed.setTitle(
      `:x: You need at least ${queueSize / 2} members on your team to join the queue (including you)`
    );

    message.channel.send(wrongEmbed);
    return;
  }

  if (message.content.split(" ").length !== queueSize / 2) {
    wrongEmbed.setTitle(`:x: Please tag ${queueSize / 2 - 1} teammates to play with you`);

    message.channel.send(wrongEmbed);
    return;
  }

  let isInTeam = true;

  message.mentions.members.forEach((e) => {
    if (!fetchedTeam.members.includes(e.user.id)) {
      wrongEmbed.setTitle(`:x: ${e.user.username} is not on your team!`);

      message.channel.send(wrongEmbed);
      isInTeam = false;
    }
  });

  if (!isInTeam) return;

  const toPush = {
    name: fetchedTeam.name,
    captain: fetchedTeam.captain,
    members: [...message.mentions.members.map((e) => e.user.id)],
    time: new Date(),
  };

  queueArray.push(toPush);

  correctEmbed.setTitle(`:white_check_mark: Added to queue! ${queueArray.length}/2`);

  message.channel.send(correctEmbed);

  if (queueArray.length === 2) {
    try {
      gameCount.value++;

      shuffle(queueArray);

      const gameCreatedObj = {
        queueSize,
        gameId: gameCount.value,
        time: new Date(),
        channelId,
        guildId: message.guild.id,
        team1: queueArray[0],
        team2: queueArray[1],
        voiceChannelIds: [],
      };
      const promises = [];
      for (const team of queueArray) {
        const dbRequest = TeamsCollection.findOne({
          name: team.name,
          guildId: message.guild.id,
        }).then(async (storedTeam) => {
          if (!storedTeam.channels.map((e) => e.channelId).includes(channelId)) {
            await TeamsCollection.update(
              {
                name: team.name,
                guildId: message.guild.id,
              },
              {
                $push: {
                  channels: {
                    channelId,
                    wins: 0,
                    losses: 0,
                    mmr: 1000,
                  },
                },
              }
            );
          }
        });
        promises.push(dbRequest);
      }
      await Promise.all(promises);

      const valuesforpm = {
        name: Math.floor(Math.random() * 99999) + 100,
        password: Math.floor(Math.random() * 99999) + 100,
      };

      const permissionOverwritesTeam1 = [
        {
          id: message.guild.id,
          deny: "CONNECT",
        },
      ];

      for (const id of [gameCreatedObj.team1.captain, ...gameCreatedObj.team1.members]) {
        permissionOverwritesTeam1.push({
          id,
          allow: "CONNECT",
        });
      }

      const orangeTeamVc = await message.guild.channels
        .create(`🔸Team-${gameCreatedObj.team1.name}-Game-${gameCreatedObj.gameId}`, {
          type: "voice",
          parent: message.channel.parentID,
          permissionOverwrites: permissionOverwritesTeam1,
        })
        .catch(() =>
          message.channel.send("Error creating voice channels, are you sure the bot has permissions to do so?")
        );

      gameCreatedObj.voiceChannelIds.push({
        id: orangeTeamVc.id,
        channelName: `🔸Team-${gameCreatedObj.team1.name}-Game-${gameCreatedObj.gameId}`,
        channel: channelId,
      });

      const permissionOverwritesTeam2 = [
        {
          id: message.guild.id,
          deny: "CONNECT",
        },
      ];

      for (const id of [gameCreatedObj.team2.captain, ...gameCreatedObj.team2.members]) {
        permissionOverwritesTeam2.push({
          id,
          allow: "CONNECT",
        });
      }

      const blueTeamVc = await message.guild.channels
        .create(`🔹Team-${gameCreatedObj.team2.name}-Game-${gameCreatedObj.gameId}`, {
          type: "voice",
          parent: message.channel.parentID,
          permissionOverwrites: permissionOverwritesTeam2,
        })
        .catch(() =>
          message.channel.send("Error creating voice channels, are you sure the bot has permissions to do so?")
        );

      gameCreatedObj.voiceChannelIds.push({
        id: blueTeamVc.id,
        channelName: `🔹Team-${gameCreatedObj.team2.name}-Game-${gameCreatedObj.gameId}`,
        channel: channelId,
      });

      const ongoingGamesInsert = new OngoingGamesTeamsSchema(gameCreatedObj);

      await ongoingGamesInsert.save();

      const discordEmbed1 = new Discord.MessageEmbed()
        .setColor(EMBED_COLOR_CHECK)
        .addField("Game is ready:", `Game ID is: ${gameCreatedObj.gameId}`)
        .addField(
          `:small_orange_diamond: Team ${gameCreatedObj.team1.name}`,
          `<@${gameCreatedObj.team1.captain}>, ${gameCreatedObj.team1.members.reduce(
            (acc = "", curr) => `${acc}<@${curr}>, `,
            ""
          )}>`
        )
        .addField(
          `:small_blue_diamond: Team ${gameCreatedObj.team2.name}`,
          `<@${gameCreatedObj.team2.captain}>, ${gameCreatedObj.team2.members.reduce(
            (acc = "", curr) => `${acc}<@${curr}>, `,
            ""
          )}>`
        );

      message.channel.send(discordEmbed1);

      const JoinMatchEmbed = new Discord.MessageEmbed()
        .setColor(EMBED_COLOR_CHECK)
        .addField("Name:", valuesforpm.name)
        .addField("Password:", valuesforpm.password)
        .addField("You have to:", `Join match(Created by <@${gameCreatedObj.team1.captain}>)`);

      for (const id of [
        ...gameCreatedObj.team1.members,
        ...gameCreatedObj.team2.members,
        gameCreatedObj.team2.captain,
      ]) {
        const fetchedUser = client.users
          .fetch(id)
          .then(async (user) => {
            try {
              await user.send(JoinMatchEmbed);
            } catch (error) {
              const errorEmbed = new Discord.MessageEmbed()
                .setColor(EMBED_COLOR_WARNING)
                .setTitle(
                  `:x: Couldn't sent message to <@${id}>, please check if your DM'S aren't set to friends only.`
                );

              console.error(error);

              message.channel.send(errorEmbed);
            }
          })
          .catch(() => message.channel.send("Invalid User"));
        promises.push(fetchedUser);
      }

      const CreateMatchEmbed = new Discord.MessageEmbed()
        .setColor(EMBED_COLOR_CHECK)
        .addField("Name:", valuesforpm.name)
        .addField("Password:", valuesforpm.password)
        .addField("You have to:", "Create Custom Match");

      const create1 = await client.users.fetch(gameCreatedObj.team1.captain);
      create1.send(CreateMatchEmbed).catch((error) => {
        const errorEmbed = new Discord.MessageEmbed()
          .setColor(EMBED_COLOR_ERROR)
          .setTitle(
            `:x: Couldn't sent message to <@${gameCreatedObj.team1.captain}>, please check if your DM'S aren't set to friends only.`
          );

        message.channel.send(errorEmbed);
        console.error(error);
      });

      queueArray.splice(0, queueArray.length);
    } catch (e) {
      wrongEmbed.setTitle("Error creating teams, resetting queue.");

      message.channel.send(wrongEmbed);

      queueArray.splice(0, queueArray.length);

      console.error(e);
    }
  }
};

module.exports = {
  name: "q",
  description:
    "Enter the queue. To do this do !q and tag your other teammates(depending on the qeueSize) example: !q @Dany @Johny @Tony @David (removes team after 45 minutes if no game has been made)",
  execute,
};