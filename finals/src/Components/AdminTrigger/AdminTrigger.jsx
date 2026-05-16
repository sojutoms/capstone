import { useEffect } from 'react';

export default function AdminTrigger() {

    useEffect(() => {
        let step = 0;

        // Sequence: Ctrl+Shift first, then type a→d→m→i→n
        const steps = [
            (e) => e.ctrlKey && e.shiftKey,           // Step 1: Hold Ctrl + Shift
            (e) => e.key.toLowerCase() === 'a',        // Step 2: press A
            (e) => e.key.toLowerCase() === 'd',        // Step 3: press D
            (e) => e.key.toLowerCase() === 'm',        // Step 4: press M
            (e) => e.key.toLowerCase() === 'i',        // Step 5: press I
            (e) => e.key.toLowerCase() === 'n',        // Step 6: press N
        ];

        const handler = (e) => {
            if (steps[step](e)) {
                step++; // move to next step

                if (step === steps.length) {
                    step = 0; // reset
                    window.location.href = 'https://admingoodsolesph.online/login';
                }
            } else {
                step = 0; // wrong key — reset sequence
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    return null;
}
