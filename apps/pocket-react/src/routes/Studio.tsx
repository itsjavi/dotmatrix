// The studio: transport, channels, the piano roll screen and the sound of the selected channel.
// A share link (`/?song=…`) opens its song here; undo brings back the song that was open.
import { replace, type LoaderFunctionArgs } from "react-router";
import { ChannelRack } from "../components/ChannelRack.tsx";
import { GridTools } from "../components/GridTools.tsx";
import { InstrumentPanel } from "../components/InstrumentPanel.tsx";
import { PianoRoll } from "../components/PianoRoll.tsx";
import { SongPanel } from "../components/SongPanel.tsx";
import { Transport } from "../components/Transport.tsx";
import { decodeSong } from "../model/share.ts";
import { openSong, say } from "../state/studio.ts";
import styles from "./Studio.module.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("song");
  if (!code) return null;
  try {
    const song = await decodeSong(code);
    openSong(song, "Open shared song");
    say(`Opened the shared song “${song.title}”`);
  } catch {
    say("That share link could not be read");
  }
  return replace("/");
}

export function Component() {
  return (
    <div className={styles.studio}>
      <Transport />
      <div className={styles.deck}>
        <ChannelRack />
        <div className={styles.center}>
          <PianoRoll />
          <GridTools />
          <div className={styles.below}>
            <InstrumentPanel />
            <SongPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
