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
<table align="center" width="420px" style="background:#181818; border:2px solid #1DB954; border-radius:15px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); font-family:Arial,sans-serif;">
  <tr><td align="center" style="padding-top:20px;">
    <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg" width="50">
  </td></tr>
  <tr><td align="center" style="padding:20px;">
    <a href="${songUrl}" target="_blank">
      <img src="${imageUrl}" width="300" style="border-radius:15px; box-shadow:0 4px 12px rgba(0,0,0,0.5);"/>
    </a>
  </td></tr>
  <tr><td align="center" style="color:#ffffff; font-weight:bold; font-size:20px; padding-top:10px;">${songName}</td></tr>
  <tr><td align="center" style="color:#b3b3b3; font-size:16px; padding-bottom:20px;">${artistName}</td></tr>
</table>
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
      execSync("git push origin HEAD:main");
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
