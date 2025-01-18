require("dotenv").config();
const { scheduleJob } = require("node-schedule");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Routes,
  MessageFlags,
  REST,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const choresChannelName = "chores"; // Replace with your chores channel name
const announcementsChannelName = "announcements"; // Replace with your announcements channel name
const shoppingChannelName = "shopping-list";
const maintenanceChannelName = "maintenance";
const appointmentsChannelName = "appointments";
const billsChannelName = "bills";
const bills = []; // Store all bills
const TEST_MODE = false; // Set to false in production

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Register /appointment, /summary and /add-bill commands on startup
client.once("ready", async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName("appointment")
      .setDescription("Create a new appointment"),
    new SlashCommandBuilder()
      .setName("add-bill")
      .setDescription("Add a new bill to the bills channel"),
    new SlashCommandBuilder()
      .setName("summary")
      .setDescription("Get a summary of paid and unpaid bills this month"),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
});

// Handle /summary slash command
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === "summary") {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter bills for the current month and year
    const paidBills = bills.filter(
      (b) =>
        b.paid &&
        b.dueDate.getMonth() === currentMonth &&
        b.dueDate.getFullYear() === currentYear
    );

    const unpaidBills = bills.filter(
      (b) =>
        !b.paid &&
        b.dueDate.getMonth() === currentMonth &&
        b.dueDate.getFullYear() === currentYear
    );

    // Generate the summary message
    const summaryMessage = `📊 **Bill Summary for ${now.toLocaleString(
      "default",
      { month: "long" }
    )} ${currentYear}** 📊

**Paid Bills:**
${
  paidBills.length
    ? paidBills.map((b) => `- ${b.name}: $${b.amount.toFixed(2)}`).join("\n")
    : "No paid bills."
}

**Unpaid Bills:**
${
  unpaidBills.length
    ? unpaidBills.map((b) => `- ${b.name}: $${b.amount.toFixed(2)}`).join("\n")
    : "No unpaid bills."
}`;

    // Reply to the user with the summary
    await interaction.reply({
      content: summaryMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
});

// Add ✅ reaction to messages in the chores, shopping-list, and maintenance channel
client.on("messageCreate", async (message) => {
  if (message.channel.name === choresChannelName && !message.author.bot) {
    try {
      await message.react("✅");
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  } else if (
    message.channel.name === shoppingChannelName &&
    !message.author.bot
  ) {
    try {
      await message.react("✅");
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  } else if (
    message.channel.name === maintenanceChannelName &&
    !message.author.bot
  ) {
    try {
      await message.react("✅");
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  }
});

// Handle /appointment slash command modal
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === "appointment") {
    const modal = new ModalBuilder()
      .setCustomId("appointmentModal")
      .setTitle("New Appointment");

    const dateInput = new TextInputBuilder()
      .setCustomId("dateInput")
      .setLabel("Date (YYYY-MM-DD)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the date of the appointment")
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId("timeInput")
      .setLabel("Time (HH:MM AM/PM)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the time of the appointment")
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("descriptionInput")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("What’s the appointment about?")
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(dateInput);
    const row2 = new ActionRowBuilder().addComponents(timeInput);
    const row3 = new ActionRowBuilder().addComponents(descriptionInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
  }
});

// Handle /add-bill slash command modal
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === "add-bill") {
    const modal = new ModalBuilder()
      .setCustomId("billModal")
      .setTitle("Add a New Bill");

    const billNameInput = new TextInputBuilder()
      .setCustomId("billName")
      .setLabel("Bill Name")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., Electricity Bill")
      .setRequired(true);

    const amountInput = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("Amount")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., $120")
      .setRequired(true);

    const dueDateInput = new TextInputBuilder()
      .setCustomId("dueDate")
      .setLabel("Due Date")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., 2025-01-31")
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(billNameInput);
    const row2 = new ActionRowBuilder().addComponents(amountInput);
    const row3 = new ActionRowBuilder().addComponents(dueDateInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
  }
});

const reminders = []; // Store reminders to manage them dynamically

/// Handle appointment and bill modal submission
client.on("interactionCreate", async (interaction) => {
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "appointmentModal"
  ) {
    const date = interaction.fields.getTextInputValue("dateInput");
    const time = interaction.fields.getTextInputValue("timeInput");
    const description =
      interaction.fields.getTextInputValue("descriptionInput");

    const appointmentsChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === appointmentsChannelName
    );

    const announcementsChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === announcementsChannelName
    );

    if (appointmentsChannel && announcementsChannel) {
      try {
        // Post the appointment details in the appointments channel
        const appointmentMessage = await appointmentsChannel.send(
          `📅 **New Appointment Created** 📅
- **Date:** ${date}
- **Time:** ${time}
- **Details:** ${description}`
        );

        // Add a ✅ reaction to the message
        await appointmentMessage.react("✅");

        // Announce the success in the announcements channel
        await announcementsChannel.send(
          `✅ **An appointment has been successfully added to the schedule!** ✅`
        );

        console.log(`Raw Date Input: ${date}`);
        console.log(`Raw Time Input: ${time}`);

        // Schedule reminders
        const dueDate = new Date(`${date}T23:45:00-04:00`);
        scheduleReminders(
          appointmentsChannel,
          announcementsChannel,
          dueDate,
          description
        );

        // Reply to the user privately (ephemeral)
        await interaction.reply({
          content:
            "Your appointment has been successfully added and reminders are set!",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error posting appointment:", error);

        await interaction.reply({
          content:
            "There was an error adding your appointment. Please try again later.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      await interaction.reply({
        content:
          "One of the necessary channels (appointments or announcements) is missing. Please contact an administrator.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (
    interaction.isModalSubmit() &&
    interaction.customId === "billModal"
  ) {
    const billName = interaction.fields.getTextInputValue("billName");
    const amount = interaction.fields.getTextInputValue("amount");
    const dueDate = interaction.fields.getTextInputValue("dueDate");

    const billsChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === billsChannelName
    );

    const announcementsChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === announcementsChannelName
    );

    if (billsChannel && announcementsChannel) {
      try {
        // Post the bill details in the bills channel
        const billMessage = await billsChannel.send(
          `💸 **New Bill Added** 💸
- **Bill Name:** ${billName}
- **Amount:** ${amount}
- **Due Date:** ${dueDate}`
        );

        // Add a ✅ reaction to the message
        await billMessage.react("✅");

        // Save the bill to the in-memory array
        bills.push({
          id: billMessage.id, // Message ID to track payments
          name: billName,
          amount: parseFloat(amount.replace(/[^0-9.-]+/g, "")), // Extract numeric value
          dueDate: new Date(dueDate),
          paid: false,
        });

        // Schedule reminders for the bill
        const parsedDueDate = new Date(`${dueDate}T23:45:00-04:00`);
        scheduleReminders(
          billsChannel,
          announcementsChannel,
          parsedDueDate,
          `Bill: ${billName} (Due Date: ${dueDate})`
        );

        // Reply to the user privately (ephemeral)
        await interaction.reply({
          content:
            "Your bill has been successfully added and reminders are set!",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error posting bill:", error);

        await interaction.reply({
          content:
            "There was an error adding your bill. Please try again later.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      await interaction.reply({
        content: "Bills channel or announcements channel not found.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

// Function to schedule reminders
function scheduleReminders(channel, announcementsChannel, dueDate, details) {
  console.log(`Due Date Parsed: ${dueDate}`);

  let oneDayBefore = new Date(dueDate);
  let threeDaysBefore = new Date(dueDate);

  if (TEST_MODE) {
    // For testing, schedule reminders in seconds instead of days
    oneDayBefore = new Date(Date.now() + 10 * 1000); // 10 seconds from now
    threeDaysBefore = new Date(Date.now() + 5 * 1000); // 5 seconds from now
    console.log(
      `Test Mode: Scheduling reminders for ${details} in 5 seconds and 10 seconds.`
    );
  } else {
    // Normal scheduling for production
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
    console.log(
      `Production Mode: Scheduling reminders for ${details} on:\n3 Days Before: ${threeDaysBefore}\n1 Day Before: ${oneDayBefore}`
    );
  }

  if (threeDaysBefore > new Date()) {
    const reminder3Days = scheduleJob(threeDaysBefore, async () => {
      console.log(`Sending 3-day reminder for ${details}`);
      await announcementsChannel.send(
        `⏰ **Reminder:** 3 days left for ${details}!`
      );
    });
    reminders.push(reminder3Days);
  } else {
    console.log(
      `3-day reminder for ${details} is in the past and won't be scheduled.`
    );
  }

  if (oneDayBefore > new Date()) {
    const reminder1Day = scheduleJob(oneDayBefore, async () => {
      console.log(`Sending 1-day reminder for ${details}`);
      await announcementsChannel.send(
        `⏰ **Reminder:** 1 day left for ${details}!`
      );
    });
    reminders.push(reminder1Day);
  } else {
    console.log(
      `1-day reminder for ${details} is in the past and won't be scheduled.`
    );
  }
}

// Handle reactions for chores, shopping, maintenance, appointments, and bills
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return; // Ignore bot reactions

  const guild = reaction.message.guild;
  const announcementsChannel = guild.channels.cache.find(
    (ch) => ch.name === announcementsChannelName
  );

  if (!announcementsChannel) {
    console.error("Announcements channel not found!");
    return;
  }

  // Handle chores
  if (
    reaction.emoji.name === "✅" &&
    reaction.message.channel.name === choresChannelName
  ) {
    const chore = reaction.message.content;

    try {
      await announcementsChannel.send(
        `🎉 **A chore has been completed!**
- **Task:** ${chore}
- **Completed by:** ${user.username}`
      );

      await reaction.message.delete();
    } catch (error) {
      console.error("Error handling chore reaction:", error);
    }
  }

  // Handle shopping list
  else if (
    reaction.emoji.name === "✅" &&
    reaction.message.channel.name === shoppingChannelName
  ) {
    const item = reaction.message.content;

    try {
      await announcementsChannel.send(
        `🛒 **The ${item} from the shopping list has been added to the cart!**`
      );

      await reaction.message.delete();
    } catch (error) {
      console.error("Error handling shopping list reaction:", error);
    }
  }

  // Handle maintenance
  else if (
    reaction.emoji.name === "✅" &&
    reaction.message.channel.name === maintenanceChannelName
  ) {
    const object = reaction.message.content;

    try {
      await announcementsChannel.send(
        `🛠 **The maintenance for the ${object} has been completed!**`
      );

      await reaction.message.delete();
    } catch (error) {
      console.error("Error handling maintenance reaction:", error);
    }
  }

  // Handle appointments
  else if (
    reaction.emoji.name === "✅" &&
    reaction.message.channel.name === appointmentsChannelName
  ) {
    const appointmentDetails = reaction.message.content
      .split("\n")
      .slice(2)
      .join("\n"); // Extract details

    try {
      await announcementsChannel.send(
        `📅 **An appointment has been marked as completed!**
- **Details:** ${appointmentDetails}
- **Marked by:** ${user.username}`
      );

      await reaction.message.delete();
    } catch (error) {
      console.error("Error handling appointment reaction:", error);
    }
  }

  // Handle bills
  else if (
    reaction.emoji.name === "✅" &&
    reaction.message.channel.name === billsChannelName
  ) {
    const bill = bills.find((b) => b.id === reaction.message.id);

    if (bill) {
      bill.paid = true; // Mark as paid

      try {
        await announcementsChannel.send(
          `💸 **A bill has been marked as paid!**
- **Bill Name:** ${bill.name}`
        );

        await reaction.message.delete();
      } catch (error) {
        console.error("Error handling bill reaction:", error);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
