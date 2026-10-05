document.querySelector<HTMLButtonElement>('#grant')!.onclick = async () => {
  const status = document.querySelector('#status')!;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    status.textContent = 'Microphone permission granted. Return to the classroom tab, reopen Schwanki and check the microphone.';
  } catch {
    status.textContent = 'Microphone access was denied. Allow it in Chrome site settings, then try again.';
  }
};
