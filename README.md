# Pulse desktop app

1. Install Node.js (LTS) from https://nodejs.org
2. In this folder run:

    npm install
    npm start          # opens the app

3. To make an installer for your system:

    npm run dist       # output goes to the dist/ folder

Build on the system you want the installer for (Windows -> .exe, macOS -> .dmg, Linux -> .AppImage).
Your songs and lyrics are stored in the app's own data folder, so they persist between launches.
