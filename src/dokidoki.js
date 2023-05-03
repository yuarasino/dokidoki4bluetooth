// 定数

const D_DISPLAY_CHART_MIN = 50
const D_DISPLAY_CHART_MAX = 100

const D_SERIAL_VENDOR_ID = 0x303A


// グローバル変数

let gSerialPort = undefined
let gSerialReadableClosed = undefined
let gSerialReader = undefined
let gDisplayChart = undefined


// リアクティブ

const dkSerialIsConnecting = Vue.ref(false)
const dkDisplayImage = Vue.ref(undefined)
const dkDisplayChart = Vue.ref(undefined)
const dkSensorRate = Vue.ref(0)
const dkDisplayRateText = Vue.computed(() => dkSensorRate.value ? String(dkSensorRate.value) : "-")


/** 改行ごとにメッセージを取り出すための変換 */
class CSerialTransformer {
  constructor() {
    this.mMessage = ""
  }
  transform(chunk, controller) {
    this.mMessage += chunk
    const lines = this.mMessage.split("\n")
    this.mMessage = lines.pop()
    lines.forEach((line) => controller.enqueue(line))
  }
  flush(controller) {
    controller.enqueue(this.mMessage)
  }
}


/** ディスプレイの更新 */
const updateDisplay = () => {
  dkDisplayImage.value.classList.add("isPulsing")
  gDisplayChart.data.datasets[0].data.push(dkSensorRate.value)
  gDisplayChart.data.datasets[0].data.shift()
  gDisplayChart.update()
  setTimeout(() => dkDisplayImage.value.classList.remove("isPulsing"), 100)
  // console.log("[DEBUG] Display chart reflected.")
}


/** シリアルの更新 */
const updateSerial = async () => {
  try {
    while (true) {
      const { value: message, done } = await gSerialReader.read()
      if (done) { break }
      if (message.startsWith("<- ")) {
        console.log(message)
        const rate = Number(message.substring(3))
        dkSensorRate.value = rate
        updateDisplay()
      }
    }
  } catch (error) {
    console.log(error)
  }
  gSerialReader.releaseLock()
  await disconnectSerial()
}


/** シリアルの接続 */
const connectSerial = async () => {
  const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: D_SERIAL_VENDOR_ID }]})
  await port.open({ baudRate: 115200 })
  const decoder = new TextDecoderStream()
  const transformer = new TransformStream(new CSerialTransformer())
  const readableClosed = port.readable.pipeTo(decoder.writable)
  const reader = decoder.readable.pipeThrough(transformer).getReader()
  gSerialPort = port
  gSerialReadableClosed = readableClosed
  gSerialReader = reader
  dkSerialIsConnecting.value = true
  console.log("[INFO] Serial connected.")
  await updateSerial()
}


/** シリアルの切断 */
const disconnectSerial = async () => {
  await gSerialReadableClosed.catch(() => {})
  await gSerialPort.close()
  gSerialPort = undefined
  gSerialReadableClosed = undefined
  gSerialReader = undefined
  dkSensorRate.value = 0
  dkSerialIsConnecting.value = false
  console.log("[INFO] Serial disconnected.")
}


/** ディスプレイの設定 */
function beginDisplay() {
  gDisplayChart = new Chart(dkDisplayChart.value, {
    type: "line",
    data: {
      labels: Array(5).fill(""),
      datasets: [{
        data: Array(5).fill(0),
        borderColor: "#539EC7",
        tension: 0,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { display: false },
        y: { display: false, min: D_DISPLAY_CHART_MIN, max: D_DISPLAY_CHART_MAX },
      },
      plugins: {
        legend: { display: false },
      },
    },
  })
  console.log("[INFO] Display begun.")
}


/** Vueアプリケーション */
Vue.createApp({
  setup() {
    Vue.onMounted(() => {
      beginDisplay()
    })

    return {
      dkSerialIsConnecting,
      dkDisplayImage,
      dkDisplayChart,
      dkDisplayRateText,
      connectSerial,
    }
  }
})
.mount("#dkContainer")
