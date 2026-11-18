// The commit and the time of the build, set from the outside when the image is built (see README, "Posodobitev").
// Git is not in the image (.dockerignore), so the build passes them in as build arguments.
export const build = {
  commit: process.env.BUILD_COMMIT || 'neznano',
  time: process.env.BUILD_TIME || '',
};
