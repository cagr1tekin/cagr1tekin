const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Spotify Credentials
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

// Access Token Alma
async function getAccessToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  const response = await axios.post("https://accounts.spotify.com/api/token", params, {
    headers: {
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data.access_token;
}

async function getCurrentlyPlaying(accessToken) {
  const response = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: "Bearer " + accessToken },
    validateStatus: () => true
  });

  if (response.status === 204 || !response.data) {
    return null;
  }
  return response.data;
}

async function getLastPlayed(accessToken) {
  const response = await axios.get("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  return response.data.items[0];
}
async function updateReadme(songName, artistName, imageUrl, songUrl) {
  const readmePath = path.join(__dirname, "README.md");
  let readme = fs.readFileSync(readmePath, "utf-8");

  const regex = /<!-- SPOTIFY:START -->(.*?)<!-- SPOTIFY:END -->/s;
  const newSection = `<!-- SPOTIFY:START -->
<div align="center" style="
  background-color: #181818;
  border: 2px solid #1DB954;
  border-radius: 20px;
  padding: 30px;
  width: 420px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  color: white;
  font-family: Arial, sans-serif;
">

  <img src="${imageUrl}" width="320" style="border-radius: 15px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">

  <div style="font-size: 22px; font-weight: bold; margin-bottom: 10px;">${songName}</div>
  <div style="font-size: 16px; color: #B3B3B3; margin-bottom: 20px;">${artistName}</div>

  <a href="${songUrl}" target="_blank" style="
      display: inline-block;
      padding: 12px 30px;
      background-color: #1DB954;
      border-radius: 30px;
      color: white;
      font-weight: bold;
      font-size: 16px;
      text-decoration: none;
      transition: background-color 0.3s ease;
  ">Listen on Spotify</a>

</div>
<!-- SPOTIFY:END -->`;

  if (regex.test(readme)) {
    readme = readme.replace(regex, newSection);
  } else {
    readme += `\n${newSection}`;
  }

  fs.writeFileSync(readmePath, readme, "utf-8");
  console.log("README.md updated!");
}

function commitAndPush() {
  try {
    execSync("git config user.name 'github-actions[bot]'");
    execSync("git config user.email 'github-actions[bot]@users.noreply.github.com'");
    execSync("git add README.md");

    const changes = execSync("git status --porcelain").toString().trim();
    if (changes) {
      execSync("git commit -m 'Update Spotify Now Playing'");
      execSync("git push origin HEAD:main --force");
      console.log("Changes committed and pushed.");
    } else {
      console.log("No changes detected, skipping commit.");
    }
  } catch (err) {
    console.error("Commit & push error:", err);
  }
}


(async () => {
  try {
    const accessToken = await getAccessToken();
    let current = await getCurrentlyPlaying(accessToken);

    let songName = "";
    let artistName = "";
    let imageUrl = "";
    let songUrl = "";

    if (current && current.is_playing) {
      const song = current.item;
      songName = song.name;
      artistName = song.artists.map(a => a.name).join(", ");
      imageUrl = song.album.images[0].url;
      songUrl = song.external_urls.spotify;
    } else {
      console.log("Nothing is playing, fetching last played...");
      const recent = await getLastPlayed(accessToken);
      const song = recent.track;
      songName = song.name;
      artistName = song.artists.map(a => a.name).join(", ");
      imageUrl = song.album.images[0].url;
      songUrl = song.external_urls.spotify;
    }

    console.log("🎧 Now Playing:", `${songName} - ${artistName}`);
    await updateReadme(songName, artistName, imageUrl, songUrl);
    commitAndPush();
  } catch (err) {
    console.error(err);
  }
})();
