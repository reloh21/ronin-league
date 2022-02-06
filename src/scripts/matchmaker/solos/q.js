const Discord = require("discord.js");

const logger = require("pino")();

const client = require("../../../utils/createClientInstance.js");

const OngoingGamesSolosCollection = require("../../../utils/schemas/ongoingGamesSolosSchema.js");

const MatchmakerUsersScoreCollection = require("../../../utils/schemas/matchmakerUsersScoreSchema");

const ChannelsCollection = require("../../../utils/schemas/channelsSchema.js");

const { redisInstance } = require("../../../utils/createRedisInstance.js");

const {
  sendMessage,
  EMBED_COLOR_CHECK,
  getQueueArray,
  EMBED_COLOR_ERROR,
  EMBED_COLOR_WARNING,
  gameCount,
  shuffle,
  balanceTeamsByMmr,
} = require("../../../utils/utils.js");

const reactEmojisCaptains = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const reactEmojisrorc = ["🇨", "🇷"];

const filterReactionrorc = (reaction, user, queueArray, rorcCount) => {
  if (
    reactEmojisrorc.includes(reaction.emoji.name) &&
    queueArray.map((e) => e.userId).includes(user.userId) &&
    !rorcCount.players.includes(user.userId)
  ) {
    rorcCount.players.push(user.userId);
    return true;
  }
  return false;
};

const filterReactionCaptains = (reaction, user) =>
  user.id !== "571839826744180736" && reactEmojisCaptains.includes(reaction.emoji.name);

const choose2Players = async (dm, team, queue, captainsObject, message) => {
  if (queue.length < 2) return false;
  const CaptainRepeatingEmbed = new Discord.MessageEmbed()
    .setColor(EMBED_COLOR_WARNING)
    .setTitle("Choose two ( you have 30 seconds):");
  for (let k = 0; k < queue.length; k++) {
    CaptainRepeatingEmbed.addField(`${k + 1} :`, queue[k].username);
  }
  const privateDmMessage = await dm.send(CaptainRepeatingEmbed).catch(() => {
    const errorEmbed = new Discord.MessageEmbed()
      .setColor(EMBED_COLOR_WARNING)
      .setTitle(
        `:x: Couldn't sent message to ${dm.username}, please check if your DM'S aren't set to friends only. You need to accept DM'S from the bot in order to use captains mode`
      );

    sendMessage(message, errorEmbed);
    throw new Error("PM'S Disabled");
  });

  try {
    for (let i = 0; i < queue.length; i++) {
      privateDmMessage.react(reactEmojisCaptains[i]);
    }
  } catch {
    const errorEmbed = new Discord.MessageEmbed()
      .setColor(EMBED_COLOR_WARNING)
      .setTitle(`Error reacting to message, likely a Discord API Issue`);

    sendMessage(message, errorEmbed);
    throw new Error("PM'S Disabled");
  }

  await privateDmMessage
    .awaitReactions(filterReactionCaptains, { max: 2, time: 30000 })
    .then((collected) => {
      if (collected.first() != null) {
        if (reactEmojisCaptains.indexOf(collected.first().emoji.name) < queue.length) {
          const num = reactEmojisCaptains.indexOf(collected.first().emoji.name);

          team.push(queue[num]);

          captainsObject.usedNums.push(num);
        }
      }
      if (collected.last() != null) {
        if (
          collected.last().emoji.name !== collected.first().emoji.name &&
          reactEmojisCaptains.indexOf(collected.last().emoji.name) < queue.length &&
          reactEmojisCaptains.indexOf(collected.first().emoji.name) < queue.length
        ) {
          const num2 = reactEmojisCaptains.indexOf(collected.last().emoji.name);

          team.push(queue[num2]);

          captainsObject.usedNums.push(num2);

          queue.splice(captainsObject.usedNums[0], 1);

          if (captainsObject.usedNums[1] > captainsObject.usedNums[0]) {
            queue.splice(captainsObject.usedNums[1] - 1, 1);
          } else {
            queue.splice(captainsObject.usedNums[1], 1);
          }
        }
      }
    })
    .catch(() => {
      const errorEmbed = new Discord.MessageEmbed()
        .setColor(EMBED_COLOR_WARNING)
        .setTitle(`:x: Error choosing captains, please try again or contact a developer.`);

      sendMessage(message, errorEmbed);
      throw new Error("Error captains mode");
    });

  if (captainsObject.usedNums.length === 0) {
    team.push(queue[0]);

    team.push(queue[1]);

    queue.splice(0, 2);
  } else if (captainsObject.usedNums.length === 1) {
    queue.splice(captainsObject.usedNums[0], 1);

    team.push(queue[0]);

    queue.shift();
  }

  captainsObject.usedNums.splice(0, captainsObject.usedNums.length);
  return true;
};

const execute = async (message, queueSize) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const userId = message.author.id;

  const channelQueues = await redisInstance.getObject("channelQueues");

  const queueArray = getQueueArray(channelQueues, queueSize, message.channel.id, message.guild.id);

  const channelId = message.channel.id;

  if (queueArray.find((e) => e.userId === userId) != null) {
    wrongEmbed.setTitle(":x: You're already in the queue!");

    sendMessage(message, wrongEmbed);
    return;
  }

  const otherChannelWhereUserMightBe = channelQueues.find((e) => e.players.map((ee) => ee.userId).includes(userId));

  if (otherChannelWhereUserMightBe != null) {
    const channelQueued = (await client.channels.fetch(otherChannelWhereUserMightBe.channelId)).name;
    wrongEmbed.setTitle(`:x: You're already queued in the channel ${channelQueued}!`);

    sendMessage(message, wrongEmbed);
    return;
  }

  const ongoingGame = await OngoingGamesSolosCollection.findOne({
    $or: [
      {
        team1: { $elemMatch: { userId } },
      },
      {
        team2: { $elemMatch: { userId } },
      },
    ],
  });

  if (ongoingGame != null) {
    wrongEmbed.setTitle(":x: You're already in a game!");
    sendMessage(message, wrongEmbed);
    return;
  }

  if (queueArray.length === queueSize) {
    wrongEmbed.setTitle(":x: Please wait for the next game to be decided!");

    sendMessage(message, wrongEmbed);
    return;
  }

  const toAdd = {
    userId,
    username: message.author.username,
    date: new Date(),
  };

  queueArray.push(toAdd);

  await redisInstance.setObject("channelQueues", channelQueues);

  correctEmbed.setTitle(`:white_check_mark: Added to queue! ${queueArray.length}/${queueSize}`);

  sendMessage(message, correctEmbed);

  if (queueArray.length === queueSize) {
    try {
      gameCount.value++;

      const gameCreatedObj = {
        queueSize,
        gameId: gameCount.value,
        date: new Date(),
        channelId,
        guildId: message.guild.id,
        team1: [],
        team2: [],
        channelIds: [],
      };

      const promises = [];

      const usersInDb = await MatchmakerUsersScoreCollection.find({
        $or: queueArray.map((e) => ({
          userId: e.userId,
        })),
      });

      queueArray.forEach((user) => {
        if (usersInDb.find((e) => e.userId === user.userId) == null) {
          const newUser = {
            userId: user.userId,
            username: user.username,
            guildId: message.guild.id,
            channelId: message.channel.id,
          };

          usersInDb.push({ ...newUser });

          const matchmakerInsert = new MatchmakerUsersScoreCollection(newUser);

          promises.push(matchmakerInsert.save());
        }
      });
      await Promise.all(promises);

      promises.splice(0, promises.length);

      const valuesforpm = {
        name: Math.floor(Math.random() * 99999) + 100,
        password: Math.floor(Math.random() * 99999) + 100,
      };

      await sendMessage(
        message,
        queueArray.reduce((acc, curr) => `${acc}<@${curr.userId}>, `, "")
      );

      correctEmbed.setTitle(
        "A game has been made! Please select your preferred gamemode: Captains (Reaction C), Random (Reaction R) or Balance by MMR (Reaction B, still experimental, contact me with !credits if bugs are found) (Captains disabled for queues with less than 6 players)"
      );

      const rorcCount = {
        r: 0,
        c: 0,
        b: 0,
        players: [],
        choosenMode: null,
      };

      const rorcMessage = await message.channel.send(correctEmbed);

      await rorcMessage.react("🇨");

      await rorcMessage.react("🇷");

      await rorcMessage.react("🇧");

      await rorcMessage
        .awaitReactions((reaction, user) => filterReactionrorc(reaction, user, queueArray, rorcCount), {
          max: queueSize,
          time: 20000,
        })
        .then((collected) => {
          collected.forEach((e) => {
            switch (e.emoji.name) {
              case "c":
                rorcCount.r = e.count;
                break;
              case "🇷": {
                rorcCount.r = e.count;
                break;
              }
              default: {
                rorcCount.b = e.count;
              }
            }
          });
        });

      if (rorcCount.r > rorcCount.c && rorcCount.r > rorcCount.b) {
        rorcCount.choosenMode = "r";
      } else if (rorcCount.c > rorcCount.r && rorcCount.c > rorcCount.b) {
        rorcCount.choosenMode = "c";
      } else if (rorcCount.b > rorcCount.r && rorcCount.b > rorcCount.c) {
        rorcCount.choosenMode = "b";
      }

      if (rorcCount.choosenMode == null || (rorcCount.choosenMode === "c" && queueSize < 6)) {
        const randomNumberLol = Math.round(Math.random() * 2);
        if (randomNumberLol === 0 && queueSize > 4) {
          rorcCount.choosenMode = "c";
        } else if (randomNumberLol === 1 && queueSize > 2) {
          rorcCount.choosenMode = "b";
        } else {
          rorcCount.choosenMode = "r";
        }
      }

      const playersWithMmr = usersInDb.map((e) => {
        return {
          username: queueArray.find((ee) => ee.userId === e.userId).username,
          userId: e.userId,
          mmr: e.mmr != null ? e.mmr : 1000,
        };
      });

      switch (rorcCount.choosenMode) {
        case "r": {
          shuffle(playersWithMmr);

          for (let i = 0; i < playersWithMmr.length / 2; i++) {
            gameCreatedObj.team1.push(playersWithMmr[i]);
          }

          for (let i = playersWithMmr.length / 2; i < playersWithMmr.length; i++) {
            gameCreatedObj.team2.push(playersWithMmr[i]);
          }

          break;
        }
        case "c": {
          let hasVoted = false;

          const captainsObject = {
            captain1: null,
            captain2: null,
            team1: [],
            team2: [],
            usedNums: [],
          };

          const queueArrayCopy = [...playersWithMmr];

          shuffle(queueArrayCopy);

          [captainsObject.captain1, captainsObject.captain2] = queueArrayCopy;

          queueArrayCopy.splice(0, 2);

          const CaptainsEmbed = new Discord.MessageEmbed()
            .setColor(EMBED_COLOR_WARNING)
            .setTitle(`Game Id: ${gameCreatedObj.gameId}`)
            .addField("Captain for team 1", captainsObject.captain1.name)
            .addField("Captain for team 2", captainsObject.captain2.name);

          sendMessage(message, CaptainsEmbed);

          const privateDmCaptain1 = await client.users.fetch(captainsObject.captain1.userId).catch(() => {
            throw new Error("Invalid captain");
          });

          const privateDmCaptain2 = await client.users.fetch(captainsObject.captain2.userId).catch(() => {
            throw new Error("Invalid captain");
          });

          const Captain1Embed = new Discord.MessageEmbed()
            .setColor(EMBED_COLOR_WARNING)
            .setTitle("Choose one ( you have 30 seconds):");
          for (let k = 0; k < queueArrayCopy.length; k++) {
            Captain1Embed.addField(`${k + 1} :`, queueArrayCopy[k].name);
          }

          const privateDmCaptain1Message = await privateDmCaptain1.send(Captain1Embed).catch(() => {
            const errorEmbed = new Discord.MessageEmbed()
              .setColor(EMBED_COLOR_WARNING)
              .setTitle(
                `:x: Couldn't sent message to ${privateDmCaptain1.username}, please check if your DM'S aren't set to friends only. You need to accept DM'S from the bot in order to use captains mode`
              );

            sendMessage(message, errorEmbed);
            throw new Error("PM'S Disabled");
          });

          for (let i = 0; i < queueArrayCopy.length; i++) {
            privateDmCaptain1Message.react(reactEmojisCaptains[i]);
          }

          await privateDmCaptain1Message
            .awaitReactions(filterReactionCaptains, { max: 1, time: 30000 })
            .then((collected) => {
              if (collected.first() != null) {
                const num = reactEmojisCaptains.indexOf(collected.first().emoji.name);

                captainsObject.team1.push(queueArrayCopy[num]);

                queueArrayCopy.splice(num, 1);

                hasVoted = true;
              }
            })
            .catch(() => {
              const errorEmbed = new Discord.MessageEmbed()
                .setColor(EMBED_COLOR_WARNING)
                .setTitle(
                  `:x: Error reacting to message in DMS, please check if your DM'S aren't set to friends only. You need to accept DM'S from the bot in order to use captains mode`
                );

              sendMessage(message, errorEmbed);
              throw new Error("PM'S Disabled");
            });

          if (!hasVoted) {
            captainsObject.team1.push(queueArrayCopy[0]);

            queueArrayCopy.shift();
          }

          hasVoted = false;
          const captains = [
            {
              captainDm: privateDmCaptain2,
              team: captainsObject.team2,
            },
            {
              captainDm: privateDmCaptain1,
              team: captainsObject.team1,
            },
          ];
          let wasLastCaptainTeam1;
          while (queueArrayCopy.length > 1) {
            // eslint-disable-next-line no-restricted-syntax
            for (const captain of captains) {
              // eslint-disable-next-line no-await-in-loop
              wasLastCaptainTeam1 = await choose2Players(
                captain.captainDm,
                captain.team,
                queueArrayCopy,
                captainsObject,
                message
              );
            }
          }

          const teamChosen = !wasLastCaptainTeam1 ? "team1" : "team2";

          captainsObject[teamChosen].push(queueArrayCopy[0]);

          captainsObject.team1.push(captainsObject.captain1);

          captainsObject.team2.push(captainsObject.captain2);

          gameCreatedObj.team1 = [...captainsObject.team1];

          gameCreatedObj.team2 = [...captainsObject.team2];
          break;
        }
        case "b": {
          const teams = balanceTeamsByMmr(playersWithMmr, queueSize);

          gameCreatedObj.team1 = teams.team1;

          gameCreatedObj.team2 = teams.team2;
          break;
        }

        default:
          break;
      }

      const channelData = await ChannelsCollection.findOne({ channelId: message.channel.id });

      if (channelData.createVoiceChannels) {
        const permissionOverwritesTeam1 = [
          {
            id: message.guild.id,
            deny: "CONNECT",
          },
        ];

        gameCreatedObj.team1.forEach((user) => {
          permissionOverwritesTeam1.push({
            id: user.userId,
            allow: "CONNECT",
          });
        });

        await message.guild.channels
          .create(`🔸Team-1-Game-${gameCreatedObj.gameId}`, {
            type: "voice",
            parent: message.channel.parentID,
            permissionOverwrites: permissionOverwritesTeam1,
          })
          .then((e) => {
            gameCreatedObj.channelIds.push(e.id);
          })
          .catch(() =>
            sendMessage(message, "Error creating voice channels, are you sure the bot has permissions to do so?")
          );

        const permissionOverwritesTeam2 = [
          {
            id: message.guild.id,
            deny: "CONNECT",
          },
        ];

        gameCreatedObj.team2.forEach((user) => {
          permissionOverwritesTeam2.push({
            id: user.userId,
            allow: "CONNECT",
          });
        });

        await message.guild.channels
          .create(`🔹Team-2-Game-${gameCreatedObj.gameId}`, {
            type: "voice",
            parent: message.channel.parentID,
            permissionOverwrites: permissionOverwritesTeam2,
          })
          .then((e) => {
            gameCreatedObj.channelIds.push(e.id);
          })
          .catch(() =>
            sendMessage(message, "Error creating voice channels, are you sure the bot has permissions to do so?")
          );
      }

      if (channelData.createTextChannels) {
        const permissionOverwrites = [
          {
            id: message.guild.id,
            deny: "VIEW_CHANNEL",
          },
        ];

        [...gameCreatedObj.team1, ...gameCreatedObj.team2].forEach((user) => {
          permissionOverwrites.push({
            id: user.userId,
            allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"],
            deny: "MANAGE_MESSAGES",
          });
        });

        await message.guild.channels
          .create(`Matchmaker-Game-${gameCreatedObj.gameId}`, {
            type: "text",
            parent: message.channel.parentID,
            permissionOverwrites,
          })
          .then(async (e) => {
            gameCreatedObj.channelIds.push(e.id);
          })
          .catch(() =>
            sendMessage(message, "Error creating text chat, are you sure the bot has permissions to do so?")
          );
      }

      const discordEmbed1 = new Discord.MessageEmbed()
        .setColor(EMBED_COLOR_CHECK)
        .addField("Game is ready:", `Game Id is: ${gameCreatedObj.gameId}`)
        .addField(
          ":small_orange_diamond: -Team 1-",
          gameCreatedObj.team1.reduce((acc, curr) => `${acc}<@${curr.userId}>, `, "")
        )
        .addField(
          ":small_blue_diamond: -Team 2-",
          gameCreatedObj.team2.reduce((acc, curr) => `${acc}<@${curr.userId}>, `, "")
        );

      sendMessage(message, discordEmbed1);

      if (channelData.sendDirectMessage) {
        const JoinMatchEmbed = new Discord.MessageEmbed()
          .setColor(EMBED_COLOR_CHECK)
          .addField("Name:", valuesforpm.name)
          .addField("Password:", valuesforpm.password)
          .addField("You have to:", `Join match(Created by ${gameCreatedObj.team1[0].username})`);

        const playersArray = gameCreatedObj.team1.concat(gameCreatedObj.team2);

        playersArray.forEach((users) => {
          if (users.userId !== gameCreatedObj.team1[0].userId) {
            const fetchedUser = client.users
              .fetch(users.userId)
              .then(async (user) => {
                try {
                  await user.send(JoinMatchEmbed);
                } catch (error) {
                  const errorEmbed = new Discord.MessageEmbed()
                    .setColor(EMBED_COLOR_WARNING)
                    .setTitle(
                      `:x: Couldn't sent message to ${users.username}, please check if your DM'S aren't set to friends only.`
                    );

                  sendMessage(message, errorEmbed);
                }
              })
              .catch(() => sendMessage(message, "Invalid User"));
            promises.push(fetchedUser);
          }
        });

        await Promise.all(promises);

        const CreateMatchEmbed = new Discord.MessageEmbed()
          .setColor(EMBED_COLOR_CHECK)
          .addField("Name:", valuesforpm.name)
          .addField("Password:", valuesforpm.password)
          .addField("You have to:", "Create Custom Match");

        const fetchedUser = await client.users
          .fetch(gameCreatedObj.team1[0].userId)
          .catch(() => sendMessage(message, "Invalid User"));

        await fetchedUser.send(CreateMatchEmbed).catch(() => {
          const errorEmbed = new Discord.MessageEmbed()
            .setColor(EMBED_COLOR_WARNING)
            .setTitle(
              `:x: Couldn't sent message to ${gameCreatedObj.team1[0].username}, please check if your DM'S aren't set to friends only.`
            );

          sendMessage(message, errorEmbed);
        });
      }
      const ongoingGamesInsert = new OngoingGamesSolosCollection(gameCreatedObj);

      await ongoingGamesInsert.save();

      queueArray.splice(0, queueArray.length);

      await redisInstance.setObject("channelQueues", channelQueues);
    } catch (e) {
      wrongEmbed.setTitle(":x: Error creating teams, resetting queue.");

      sendMessage(message, wrongEmbed);

      queueArray.splice(0, queueSize);

      await redisInstance.setObject("channelQueues", channelQueues);

      logger.error(e);
    }
  }
};

module.exports = {
  name: "q",
  description: "Enter the queue (removes player after 45 minutes if no game has been made)",
  execute,
};
