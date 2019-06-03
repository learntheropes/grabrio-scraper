function sleep(min, max) {
  const ms = Math.floor(Math.random() * max) + min
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  sleep
}