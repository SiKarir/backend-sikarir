const tf = require('@tensorflow/tfjs-node');

const MODEL_URL = 'https://storage.googleapis.com/model-si-karir/model-si-karir/model.json';

async function loadModel() {
  try {
    const model = await tf.loadGraphModel(MODEL_URL);
    console.log('Model berhasil dimuat!');
    return model;
  } catch (error) {
    console.error('Terjadi kesalahan saat memuat model:', error);
    throw error;
  }
}

async function predict(model, inputData) {
  try {
    const inputTensor = tf.tensor2d(inputData, [1, inputData.length]);
    const prediction = await model.predict(inputTensor);
    const result = prediction.dataSync();
    return result;
  } catch (error) {
    console.error('Terjadi kesalahan saat melakukan prediksi:', error);
    throw error;
  }
}

module.exports = { loadModel, predict };
