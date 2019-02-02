const isObject = val =>
  Object.prototype.toString.call(val) === '[object Object]'

const isType = (val, type) => {
  switch (type) {
    case 'object':
      return isObject(val)
    case 'array':
      return Array.isArray(val)
    case 'null':
      return val === null
    default:
      return typeof val === type; // eslint-disable-line
  }
}

const _validate = (
  sourceObj,
  types,
  defaults,
  hasDefaults = isObject(defaults)
) => {
  const returnObj = {}

  for (const key of Object.keys(types)) {
    const typeDefinition = types[key]
    const allowedTypes = Array.isArray(typeDefinition.type)
      ? typeDefinition.type
      : [typeDefinition.type]

    if (allowedTypes.some(allowedType => isType(sourceObj[key], allowedType))) {
      returnObj[key] = sourceObj[key]
    } else if (hasDefaults && defaults[key] !== undefined) {
      returnObj[key] = defaults[key]
    }

    const requiredPropNotPresent =
      typeDefinition.optional !== true && returnObj[key] === undefined

    const propPresentButInvalid =
      returnObj[key] !== undefined &&
      !allowedTypes.some(allowedType => isType(returnObj[key], allowedType))

    if (requiredPropNotPresent || propPresentButInvalid) {
      throw Error(
        `Validation error for ${key}, expected ${allowedTypes.join(
          ' / '
        )}, got ${returnObj[key]}`
      )
    }
  }

  return returnObj
}

function ensureObject (val, fallback = {}) {
  return isObject(val) ? val : fallback
}

class Validator {
  constructor (source) {
    this.source = source
  }

  validate () {
    if (!isObject(this.types)) {
      throw Error('Validation error: no types provided')
    }
    return _validate(this.source, this.types, this.defaults)
  }

  withTypes (types) {
    this.types = types
    return this
  }

  withDefaults (defaults) {
    this.defaults = defaults
    return this
  }
}

module.exports = {
  ensureObject,
  isObject,
  isType,
  Validator
}
