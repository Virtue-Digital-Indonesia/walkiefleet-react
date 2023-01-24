export const getBase64ID = () => {
  let array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  let b64 = ''
  for (let i = 0; i < array.length; i++) {
    b64 += String.fromCharCode(array[i])
  }
  return window.btoa(b64)
}

export const getDeviceID = () => {
  let deviceid = localStorage.getItem('DeviceID')
  if (deviceid == null) {
    deviceid = getBase64ID()
    localStorage.setItem('DeviceID', deviceid)
  }
  return deviceid
}

export const base64ToUint8Array = (base64string) => {
  let arrayBuffer = Uint8Array.from(atob(base64string), function (c) {
    return c.charCodeAt(0)
  })
  return arrayBuffer
}

export const uint8ArrayToBase64 = (arrayBuffer) => {
  let base64 = btoa(
    arrayBuffer.reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
  return base64
}