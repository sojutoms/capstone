/**
 * Calculates the difference between two objects for audit logging.
 * Returns an object containing only the fields that changed, with their old and new values.
 */
const calculateDiff = (oldObj, newObj, ignoredFields = ["updatedAt", "date", "__v"]) => {
  const diff = {};
  
  // Normalize objects
  const oldClean = JSON.parse(JSON.stringify(oldObj));
  const newClean = JSON.parse(JSON.stringify(newObj));

  Object.keys(newClean).forEach((key) => {
    if (ignoredFields.includes(key)) return;

    const oldVal = JSON.stringify(oldClean[key]);
    const newVal = JSON.stringify(newClean[key]);

    if (oldVal !== newVal) {
      diff[key] = {
        from: oldClean[key],
        to: newClean[key],
      };
    }
  });

  return diff;
};

module.exports = { calculateDiff };
