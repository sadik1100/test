// Echo any message sent to the bot
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text && !msg.text.startsWith('/')) { // Avoid echoing command messages
        bot.sendMessage(chatId, `You said: ${msg.text}`);
    }
});

const FormData = require('form-data');

let userState = {};

// Inline keyboard utility
const getInlineKeyboard = (currentPage, totalPages, isSelected) => {
  const buttons = [];

  if (isSelected) {
    buttons.push({ text: "⚙️ Processing...", callback_data: "none" });
  } else {
    if (currentPage > 0) {
      buttons.push({ text: "⬅️ Backward", callback_data: `backward:${currentPage}` });
    }
    buttons.push({ text: `🎧 Select (${currentPage + 1}/${totalPages + 1})`, callback_data: `select:${currentPage}` });
    if (currentPage < totalPages) {
      buttons.push({ text: "➡️ Forward", callback_data: `forward:${currentPage}` });
    }
  }

  return { inline_keyboard: [buttons] };
};

const updateMessage = async (chatId, messageId, searchResults, currentPage, isSelected = false) => {
  const track = searchResults[currentPage];
  const songName = track.name;
  const description = `Artist: ${track.artists[0].name} - Album: ${track.album.name}`;
  const image = track.album.images[1].url || "";
  const duration = `${Math.floor(track.duration_ms / 60000)}:${((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, "0")}`;
  const release = track.album.release_date || "";

  await bot.editMessageText(
    `<b>Song:</b> ${songName}\n<b>Artist:</b> ${track.artists[0].name}\n<b>Album:</b> ${track.album.name}\n<b>Duration:</b> ${duration}\n<b>Release Date:</b> ${release}<a href="${track.album.images[0].url}">&#8205;</a>`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: getInlineKeyboard(currentPage, searchResults.length - 1, isSelected)
    }
  );
};

// Start command
bot.onText(/\/start/, async (msg) => {
  const welcomeMessage = '<b>Hello! I am Spotify Downloader Bot 🎶</b>\n\nI can download any song from Spotify and send it to you as an audio file.\n\nJust send me the Spotify song URL like this /download SONG_URL or use the /search command to search for a song and directly download it.\n⁉️ For more information use the /help command.\n\n🗑️ <i>Feel free to delete message to keep our chat clean and focused on music!</i>\n\n<b>🎵 Developed with ❤️ by </b><a href="tg://user?id=5429844896">Abdul Kioum</a>';
  const gifUrl = "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9zeWpuNHNoOHViejMzcm5jZmcwZjVpeGFrdWlqbzlhYXFhd29vZiZlcD12MV9pbnRlcm5naWZfYnlfaWQmY3Q9Zw/EFGXDUBXcUd131C0CR/giphy.gif";

  try {
    await bot.sendAnimation(msg.chat.id, gifUrl, { caption: welcomeMessage, parse_mode: 'HTML' });
  } catch (error) {
    console.error("Error sending welcome message:", error);
    await bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'HTML' });
  }
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const helpMessage = "<b>⁉️ How to use?</b>\n\n<b>🔍 Search and download</b>\nYou can directly search and download from spotify by using /search command and selecting your song.\n\n<i>Example:\n</i><pre>/search daku</pre>\n\n<b>📩 Directly download by song URL</b>\nYou can directly download from spotify by using /download command.\n\n<i>Example:</i>\n<pre>/download https://open.spotify.com/track/71XxylHoSigwo354LSy5p6?si=fa0b9772252b4ca0</pre>\n\n🗑️ <i>Feel free to delete messages to keep our chat clean and focused on music!</i>\n\n<b>🎧Happy lisenting...</b>";

  await bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
});

// Search command
bot.onText(/\/search (.+)/, async (msg, match) => {
  const query = match[1];

  try {
    const searchTrack = await search(query, 10);
    let searchResults = searchTrack.items;

    if (searchResults.length === 0) {
      return bot.sendMessage(msg.chat.id, "No results found");
    }

    const currentPage = 0;
    userState[msg.from.id] = { searchResults, currentPage };

    const track = searchResults[currentPage];
    const songName = track.name;
    const description = `Artist: ${track.artists[0].name} - Album: ${track.album.name}`;
    const image = track.album.images[1].url || "";
    const duration = `${Math.floor(track.duration_ms / 60000)}:${((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, "0")}`;
    const release = track.album.release_date || "";

    await bot.sendMessage(
      msg.chat.id,
      `<b>Song:</b> ${songName}\n<b>Artist:</b> ${track.artists[0].name}\n<b>Album:</b> ${track.album.name}\n<b>Duration:</b> ${duration}\n<b>Release Date:</b> ${release}<a href="${track.album.images[0].url}">&#8205;</a>`,
      {
        parse_mode: 'HTML',
        reply_markup: getInlineKeyboard(currentPage, searchResults.length - 1, false)
      }
    );
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, "Failed to search for tracks");
  }
});

// Handle inline button actions
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data.split(':')[0];
  const currentPage = parseInt(callbackQuery.data.split(':')[1]);
  const userId = callbackQuery.from.id;

  if (!userState[userId]) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Please search again." });
  }

  let { searchResults } = userState[userId];
  let newPage = currentPage;

  if (action === 'forward') {
    newPage = Math.min(currentPage + 1, searchResults.length - 1);
  } else if (action === 'backward') {
    newPage = Math.max(currentPage - 1, 0);
  }

  if (action === 'select') {
    const selectedTrack = searchResults[currentPage];
    const spotifyUrl = selectedTrack.external_urls.spotify;
    userState[userId].selected = true;

    await updateMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id, searchResults, currentPage, true);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "⬇️ Downloading, please wait..." });

    try {
      const data = new FormData();
      data.append('url', spotifyUrl);

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://spotisongdownloader.com/api/composer/spotify/swd.php',
        headers: {
          ...data.getHeaders(),
        },
        data: data,
      };

      const response = await axios.request(config);
      const downloadUrl = response.data.dlink;

      let songData = await axios.get(`https://spotifydownloaders.com/api/getSpotifyDetails?url=${spotifyUrl}`);
      songData = songData.data;

      let songName = songData.tracks[0].name;
      let artistName = songData.tracks[0].artist;
      let albumArt = songData.preview.image;
      let songDuration = songData.tracks[0].duration / 1000;

      await bot.sendChatAction(callbackQuery.from.id, 'upload_audio');

      try {
        await bot.sendAudio(
          callbackQuery.from.id,
          downloadUrl,
          {
            title: songName,
            performer: artistName,
            duration: songDuration,
            thumb: albumArt,
          }
        );
      } catch (error) {
        await bot.sendAudio(callbackQuery.from.id, downloadUrl);
      }

      await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
    } catch (error) {
      console.error("Error processing download:", error);
      await bot.sendMessage(callbackQuery.from.id, "Failed to download and send audio.");
    }

    return;
  }

  userState[userId].currentPage = newPage;
  await updateMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id, searchResults, newPage);
});

// Download command
bot.onText(/\/download (.+)/, async (msg, match) => {
  const spotifyUrl = match[1].trim();

  if (!spotifyUrl.startsWith('https://open.spotify.com/track/')) {
    const errorMessage = await bot.sendMessage(
      msg.chat.id,
      "❌ Please enter a valid Spotify song URL, starting with 'https://open.spotify.com/track/'.\n\n🗑️ This message will be automatically deleted in 10 seconds..."
    );

    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, errorMessage.message_id);
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    }, 10000);

    return;
  }

  try {
    const processingMessage = await bot.sendMessage(msg.chat.id, "⚙️ Processing...");

    const data = new FormData();
    data.append('url', spotifyUrl);

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://spotisongdownloader.com/api/composer/spotify/swd.php',
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };

    const response = await axios.request(config);
    const downloadUrl = response.data.dlink;

    let songData = await axios.get(`https://spotifydownloaders.com/api/getSpotifyDetails?url=${spotifyUrl}`);
    songData = songData.data;

    let songName = songData.tracks[0].name;
    let artistName = songData.tracks[0].artist;
    let albumArt = songData.preview.image;
    let songDuration = songData.tracks[0].duration / 1000;

    await bot.sendChatAction(msg.chat.id, 'upload_audio');

    try {
      await bot.sendAudio(
        msg.chat.id,
        downloadUrl,
        {
          title: songName,
          performer: artistName,
          duration: songDuration,
          thumb: albumArt,
        }
      );
    } catch (error) {
      await bot.sendAudio(msg.chat.id, downloadUrl);
    }

    await bot.deleteMessage(msg.chat.id, processingMessage.message_id);
  } catch (error) {
    console.error("Error processing download:", error);
    await bot.sendMessage(msg.chat.id, "Failed to download and send audio.");
  }
});

