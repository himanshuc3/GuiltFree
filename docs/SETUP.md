# Setup on Linux

Everything runs locally. Do the steps in order; each section works on its own, so you can stop after step 2
and still have a working demo with mock data.

## 1. Node

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
# restart the shell, then:
nvm install 22
```

## 2. Android emulator (for the app)

You do not need a phone, and with Expo Go you do not need a JDK or Gradle.

1. Check KVM is usable: `ls -l /dev/kvm` and `groups` should include `kvm`.
   If not: `sudo usermod -aG kvm $USER`, then log out and back in.
2. Install [Android Studio](https://developer.android.com/studio). In **Device Manager** create a virtual device
   (a recent Pixel with a Play Store image) and start it.
3. Add the SDK tools to your shell profile, adjusting the path if Android Studio put the SDK elsewhere:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
   ```
   `adb devices` should list the emulator.
4. In one terminal `npm run dev:server`, in another `npm run dev:mobile`, then press **a**. Expo installs
   Expo Go on the emulator and opens the app.

The emulator reaches the server on your machine as `http://10.0.2.2:3000`, which is the app's default. If you
change the server port, set `EXPO_PUBLIC_API_URL` (put it in `apps/mobile/.env.local`, which is git-ignored).

If the app shows "Cannot reach the server", check the server is running and that `curl localhost:3000/health`
works on your machine.

## 3. MongoDB Atlas (optional)

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access**: add a user with a password. **Network Access**: add your current IP.
3. **Connect → Drivers**: copy the connection string into `.env` as `MONGODB_URI`.
   The password goes in `.env` only, never in a committed file.

Restart the server; the startup line should say `store=mongodb`.

## 4. Gmail (optional)

1. In [Google Cloud Console](https://console.cloud.google.com) create a project and enable the **Gmail API**.
2. **OAuth consent screen**: user type *External*, publishing status *Testing*, and add your own Gmail address as
   a **test user**.
3. **Credentials → Create credentials → OAuth client ID**, type *Web application*, authorised redirect URI
   `http://localhost:3000/auth/google/callback`.
4. Put the client id and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and set `GMAIL_MODE=google`.
5. Restart the server, open <http://localhost:3000/auth/google/start> in a browser on that machine and approve
   read-only access. The scope requested is `gmail.readonly` and the server only searches for
   `from:noreply@swiggy.in subject:"successfully delivered"`.

While the consent screen is in *Testing*, Google expires the refresh token after 7 days; just repeat step 5.
Without Mongo, tokens live in memory and are lost on restart, so use Atlas if you want the connection to persist.

Set `TRACKING_SINCE` to the moment you start tracking (or remove it to use first server start). To demo with
real mail you may want it a few days in the past.

## 5. Calorie model (optional)

Any OpenAI-compatible endpoint serving an open-weight model works. With [OpenRouter](https://openrouter.ai):

```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=<your key>
LLM_MODEL=<a Gemma model slug>
```

Check the exact slug on <https://openrouter.ai/models>; the default in `.env.example` is a guess and may not
exist. For a local model, run [Ollama](https://ollama.com) and use `LLM_BASE_URL=http://localhost:11434/v1`
with any non-empty `LLM_API_KEY`.

The server startup line shows `llm=live (<model>)` once a key is set. The app's Settings tab shows the same.

## Regenerating fixtures from a real email

In Gmail open the email, **⋮ → Show original → Download original**, then:

```bash
node scripts/make-fixtures.mjs path/to/email.eml
```

This replaces the customer name and address with placeholders. `*.eml` and `*.pdf` are git-ignored; the raw
email contains personal data and must not be committed.

## Troubleshooting

- **Port 3000 in use**: set `PORT` in `.env` and `EXPO_PUBLIC_API_URL` to match.
- **`401 unauthorized`**: `APP_API_KEY` on the server and `EXPO_PUBLIC_API_KEY` in the app must match
  (both default to `dev-api-key`).
- **Gmail "access blocked"**: your address is not listed as a test user on the OAuth consent screen.
- **Order stuck without calories**: the model call failed; the server retries on every sync and logs why.
