const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

const getLog = () => ({
  info: (message) => console.info(message),
  notice: (message) => console.log(message),
  warning: (message) => console.warn(message),
  error: (message) => console.error(message),
});

module.exports = {
  capitalize,
  getLog,
};
