// 個人設定
const D_DISPLAY_CHART_MIN = 50
const D_DISPLAY_CHART_MAX = 100


// テンプレート設定
const D_SERIAL_VENDOR_ID = 0x303A


/** 改行ごとにメッセージを取り出すための変換器 */
class CSerialTransformer {
  constructor() {
    this.mChunk = "";
  }
  transform(chunk, controller) {
    this.mChunk += chunk
    const lines = this.mChunk.split("\n")
    this.mChunk = lines.pop()
    lines.forEach((line) => controller.enqueue(line))
  }
  flush(controller) {
    controller.enqueue(this.mChunk)
  }
}


/** Vueアプリケーション */
const gApp = Vue.createApp({
  setup() {
    let mDisplayChart = undefined
    let mSerialPort = undefined
    const gDisplayImage = Vue.ref()
    const gDisplayChart = Vue.ref()
    const gSensorRate = Vue.ref(0)
    const gSerialIsConnected = Vue.ref(false)

    const gDisplaySensorText = Vue.computed(() => gSensorRate.value ? String(gSensorRate.value) : "-")

    const updateDisplay = () => {
      gDisplayImage.value.classList.toggle("isPulsed1")
      gDisplayImage.value.classList.toggle("isPulsed2")
      mDisplayChart.data.datasets[0].data.push(gSensorRate.value)
      mDisplayChart.data.datasets[0].data.shift()
      mDisplayChart.update()
      // console.log(`[DEBUG] Display updated.`)
    }

    const loopSerial = async () => {
      const decoderStream = new TextDecoderStream()
      const transformerStream = new TransformStream(new CSerialTransformer())
      const readableStreamClosed = mSerialPort.readable.pipeTo(decoderStream.writable)
      const reader = decoderStream.readable.pipeThrough(transformerStream).getReader()
      try {
        while (true) {
          const { value: message, done } = await reader.read()
          if (done) { break }
          if (message.startsWith("<- ")) {
            const rate = Number(message.substring(3))
            gSensorRate.value = rate
            console.log(`[INFO] Serial message received. ${message}`)
            updateDisplay()
          }
        }
      } catch (error) {
        console.error(`[ERROR] Serial error catched. ${error}`)
      }
      finally {
        reader.releaseLock()
      }
      await readableStreamClosed.catch(() => {})
      await mSerialPort.close()
      mSerialPort = undefined
      gSensorRate.value = 0
      gSerialIsConnected.value = false
      console.error(`[INFO] Serial disconnected.`)
    }

    const connectSerial = async () => {
      const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: D_SERIAL_VENDOR_ID }]})
      mSerialPort = port
      await port.open({ baudRate: 115200 })
      gSerialIsConnected.value = true
      console.log(`[INFO] Serial connected.`)
      await loopSerial()
    }

    const beginDisplay = () => {
      const data = Array(10).fill(0)
      mDisplayChart = new Chart(gDisplayChart.value, {
        type: "line",
        data: {
          labels: [...data.keys()],
          datasets: [{
            data: data,
            fill: false,
            borderColor: "#539EC7",
            tension: 0,
            pointRadius: 0,
          }]
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
        }
      })
      // console.log(`[DEBUG] Display begun.`)
    }

    Vue.onMounted(() => {
      beginDisplay()
    })

    return {
      gDisplayImage,
      gDisplaySensorText,
      gDisplayChart,
      gSerialIsConnected,
      connectSerial,
    }
  }
})
gApp.mount("#dkContainer")
