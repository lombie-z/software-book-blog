'use client';

import { createContext, useContext } from 'react';

/** True once the shared WebGL canvas is mounted; false means render the static fallbacks. */
export const SceneAvailableContext = createContext(false);

export const useSceneAvailable = () => useContext(SceneAvailableContext);
