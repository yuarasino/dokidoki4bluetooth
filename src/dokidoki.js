// テンプレート設定 ※触らないでね
const DK_BLE_DEVICE_NAME = "dokidoki";
const DK_BLE_SERVICE_UUID = "da43aef5-6f7c-5e04-a350-1284e36c1f05";
const DK_BLE_CHARACTERISTIC_UUID = "d21408ba-c9bb-e952-4762-3168a403b42e";


/** Vueアプリケーション */
const dkApp = Vue.createApp({
  setup() {
    let mHRSChart = undefined;
    let mBLECharacteristic = undefined;
    const dkHRSImage = Vue.ref();
    const dkHRSChart = Vue.ref();
    const dkHRSRate = Vue.ref(0);
    const dkBLEIsActive = Vue.ref(false);

    const mUpdateHRS = async (event) => {
      const message = new TextDecoder().decode(event.target.value);
      console.log(`[INFO] BLE message received. ${message}`);
      if (message.startsWith("<- ")) {
        const rate = Number(message.substring(3));
        dkHRSRate.value = rate;
        dkHRSImage.value.classList.toggle("pulse1");
        dkHRSImage.value.classList.toggle("pulse2");
        mHRSChart.data.datasets[0].data.push(rate);
        mHRSChart.data.datasets[0].data.shift();
        mHRSChart.update();
        console.log(`[INFO] HRS rate changed. ${rate}`);
      }
    };

    const mDisconnectBLE = async () => {
      mHRSChart.data.datasets[0].data = Array(10).fill(0);
      dkHRSRate.value = 0;
      mBLECharacteristic = undefined;
      dkBLEIsActive.value = false;
      console.log(`[INFO] BLE disconnected.`);
    };

    const dkConnectBLE = async () => {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: DK_BLE_DEVICE_NAME }],
        optionalServices: [DK_BLE_SERVICE_UUID],
      });
      device.addEventListener("gattserverdisconnected", mDisconnectBLE);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(DK_BLE_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(DK_BLE_CHARACTERISTIC_UUID);
      mBLECharacteristic = characteristic;
      characteristic.addEventListener("characteristicvaluechanged", mUpdateHRS);
      characteristic.startNotifications();
      dkBLEIsActive.value = true;
      console.log(`[INFO] BLE connected.`);
    };

    Vue.onMounted(() => {
      const data = Array(10).fill(0);
      mHRSChart = new Chart(dkHRSChart.value, {
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
            x: { 
              display: false,
            },
            y: { 
              display: false,
              min: 50,
              max: 100,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        }
      });
    });

    return {
      dkHRSImage,
      dkHRSChart,
      dkHRSRate,
      dkBLEIsActive,
      dkConnectBLE,
    };
  },
});
dkApp.mount("#dkContainer");
