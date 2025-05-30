const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

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

async function updateReadme(content) {
  const readmePath = path.join(__dirname, "..", "README.md");
  let readme = fs.readFileSync(readmePath, "utf-8");

  const regex = /🎧 Now Playing: .*/;
  const newLine = `🎧 Now Playing: ${content}`;

  if (regex.test(readme)) {
    readme = readme.replace(regex, newLine);
  } else {
    readme += "\n" + newLine;
  }

  fs.writeFileSync(readmePath, readme, "utf-8");
  console.log("README.md updated!");
}

function commitAndPush() {
  try {
    execSync("git config user.name 'github-actions[bot]'");
    execSync("git config user.email 'github-actions[bot]@users.noreply.github.com'");
    execSync("git add README.md");
    execSync("git commit -m 'Update Spotify Now Playing'");
    execSync("git push");
    console.log("Changes committed and pushed.");
  } catch (err) {
    console.error("Nothing to commit.");
  }
}

(async () => {
  try {
    const accessToken = await getAccessToken();
    let current = await getCurrentlyPlaying(accessToken);

    let songInfo = "";
    if (current && current.is_playing) {
      const song = current.item;
      songInfo = `${song.name} - ${song.artists.map(a => a.name).join(", ")}`;
    } else {
      console.log("Nothing is playing, fetching last played...");
      const recent = await getLastPlayed(accessToken);
      const song = recent.track;
      songInfo = `${song.name} - ${song.artists.map(a => a.name).join(", ")}`;
    }

    console.log("🎧 Now Playing:", songInfo);
    await updateReadme(songInfo);
    commitAndPush();  // burada çağırıyoruz artık
  } catch (err) {
    console.error(err);
  }
})();
