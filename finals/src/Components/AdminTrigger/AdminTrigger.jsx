import { useEffect } from 'react';

export default function AdminTrigger() {

    useEffect(() => {
        let step = 0;

        const steps = [
            (e) => e.ctrlKey && e.shiftKey,
            (e) => e.key.toLowerCase() === 'a',
            (e) => e.key.toLowerCase() === 'd', 
            (e) => e.key.toLowerCase() === 'm',
            (e) => e.key.toLowerCase() === 'i',
            (e) => e.key.toLowerCase() === 'n',
        ];

        const handler = (e) => {
            if (steps[step](e)) {
                step++;

                if (step === steps.length) {
                    step = 0;
                    window.location.href = 'https://admingoodsolesph.online/login';
                }
            } else {
                step = 0;
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    return null;
}