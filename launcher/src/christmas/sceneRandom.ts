// Scenes are laid out from a fixed seed so every render, test and screenshot
// draws the same snow, stars and lights without Math.random churn.
export const createSceneRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};
