import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Background, Captions, Grain, TopBar } from "./components/Chrome";
import { Hook } from "./scenes/Hook";
import { OpenSource } from "./scenes/OpenSource";
import { Meet } from "./scenes/Meet";
import { Shortcut } from "./scenes/Shortcut";
import { Speed } from "./scenes/Speed";
import { Cleanup } from "./scenes/Cleanup";
import { Live } from "./scenes/Live";
import { Setup } from "./scenes/Setup";
import { Privacy } from "./scenes/Privacy";
import { Outro } from "./scenes/Outro";

export const DictumLaunch: React.FC<{ audio: string }> = ({ audio }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <Background />
    <Hook />
    <OpenSource />
    <Meet />
    <Shortcut />
    <Speed />
    <Cleanup />
    <Live />
    <Setup />
    <Privacy />
    <Outro />
    <Captions />
    <TopBar />
    <Grain />
    {audio ? <Audio src={staticFile(audio)} /> : null}
  </AbsoluteFill>
);
