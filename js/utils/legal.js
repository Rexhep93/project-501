// Legal document registry. Content is placeholder text suitable for
// pre-submission review; replace each `body` with final text from counsel
// before App Store submission.
//
// NOTE: Apple requires at minimum a working Privacy Policy link and, unless
// you explicitly license Apple's standard EULA in App Store Connect, a custom
// EULA reachable inside the app.

const EFFECTIVE_DATE = 'April 2026';

export const LEGAL_DOCS = {
    terms: {
        title: 'Terms of Service',
        subtitle: `Effective ${EFFECTIVE_DATE}`,
        body: [
            ['p', 'These Terms of Service ("Terms") govern your use of the Matchday application and any related services (the "Service"). By installing or using the Service you agree to these Terms. If you do not agree, do not use the Service.'],
            ['h3', '1. Eligibility'],
            ['p', 'You must be at least 13 years old (or the minimum age of digital consent in your jurisdiction) to use the Service. By using Matchday you represent that you meet this requirement.'],
            ['h3', '2. Your account and content'],
            ['p', 'Matchday does not require an account. Scores, streaks, and achievements are stored locally on your device. You are responsible for maintaining the security of your device.'],
            ['h3', '3. Acceptable use'],
            ['p', 'You agree not to reverse-engineer, decompile, scrape, or attempt to derive the source code of the Service; interfere with its operation; or use it to violate any applicable law.'],
            ['h3', '4. Intellectual property'],
            ['p', 'The Service, including its code, design, quiz questions, and branding, is owned by Matchday and its licensors and is protected by copyright and other laws. Club and player names are used descriptively and remain the property of their respective owners.'],
            ['h3', '5. Disclaimers'],
            ['p', 'The Service is provided "as is" and "as available" without warranties of any kind. We do not guarantee that daily quizzes will be error-free or uninterrupted.'],
            ['h3', '6. Limitation of liability'],
            ['p', 'To the maximum extent permitted by law, Matchday shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the Service.'],
            ['h3', '7. Changes to these Terms'],
            ['p', 'We may update these Terms from time to time. Material changes will be reflected in an updated effective date. Continued use after changes constitutes acceptance.'],
            ['h3', '8. Contact'],
            ['p', 'Questions about these Terms: legal@matchday.app.']
        ]
    },
    privacy: {
        title: 'Privacy Policy',
        subtitle: `Effective ${EFFECTIVE_DATE}`,
        body: [
            ['p', 'This Privacy Policy describes how Matchday ("we", "us") handles information in connection with the Matchday app.'],
            ['h3', '1. Information stored on your device'],
            ['p', 'Scores, streaks, achievements, settings, and cached quiz data are stored locally on your device using the operating system\'s standard preference storage. This data is not transmitted to us.'],
            ['h3', '2. Information we do not collect'],
            ['p', 'Matchday does not require an account, does not include analytics or advertising SDKs, and does not track you across apps or websites.'],
            ['h3', '3. Network requests'],
            ['p', 'The app fetches daily quiz content from our content provider over HTTPS. These requests contain standard metadata (IP address, approximate timestamp, user agent) that may be logged by the hosting provider for a limited period for security and reliability purposes. We do not associate this metadata with individuals.'],
            ['h3', '4. Children'],
            ['p', 'Matchday is a general-audience app. We do not knowingly collect personal information from children. Because Matchday stores data only on the user\'s device, no identifiable information leaves the device.'],
            ['h3', '5. Your choices'],
            ['p', 'You can delete all locally stored data by uninstalling the app or clearing the app\'s storage from your operating system settings.'],
            ['h3', '6. Changes to this policy'],
            ['p', 'We may update this policy. Material changes will be reflected in an updated effective date inside the app.'],
            ['h3', '7. Contact'],
            ['p', 'Privacy questions: privacy@matchday.app.']
        ]
    },
    eula: {
        title: 'End User License Agreement',
        subtitle: `Effective ${EFFECTIVE_DATE}`,
        body: [
            ['p', 'This End User License Agreement ("EULA") is a legal agreement between you and Matchday governing your use of the Matchday application ("Licensed Application").'],
            ['h3', '1. Scope of licence'],
            ['p', 'The licence granted to you is limited to a non-transferable licence to use the Licensed Application on any Apple-branded products that you own or control, subject to the Apple Media Services Terms and Conditions.'],
            ['h3', '2. Consent to use of data'],
            ['p', 'You agree that Matchday may collect and use technical data as described in the Privacy Policy.'],
            ['h3', '3. Termination'],
            ['p', 'This EULA is effective until terminated by you or Matchday. Your rights under this licence will terminate automatically if you fail to comply with any of its terms.'],
            ['h3', '4. No warranty'],
            ['p', 'The Licensed Application is provided "AS IS" and "AS AVAILABLE," with all faults and without warranty of any kind.'],
            ['h3', '5. Product claims'],
            ['p', 'You acknowledge that Matchday, not Apple, is responsible for addressing any claims relating to the Licensed Application, including product-liability claims, claims that the Licensed Application fails to conform to any applicable legal or regulatory requirement, and claims arising under consumer-protection, privacy, or similar legislation.'],
            ['h3', '6. Third-party terms'],
            ['p', 'You must comply with applicable third-party terms of agreement when using the Licensed Application.'],
            ['h3', '7. Third-party beneficiary'],
            ['p', 'You and Matchday acknowledge that Apple, and Apple\'s subsidiaries, are third-party beneficiaries of this EULA, and that Apple will have the right to enforce this EULA against you as a third-party beneficiary thereof.']
        ]
    },
    acknowledgments: {
        title: 'Acknowledgments',
        subtitle: 'Third-party licenses and data',
        body: [
            ['h3', 'Quiz data'],
            ['p', 'Player and club data are compiled from publicly available sources. Club and player names are used descriptively for identification purposes and remain the property of their respective owners. Matchday is not affiliated with, endorsed by, or sponsored by any football club, league, or governing body.'],
            ['h3', 'Fonts'],
            ['p', 'System typefaces (New York, SF Pro) are provided by Apple and used under the terms granted to iOS app developers.'],
            ['h3', 'Open source'],
            ['p', 'This app uses Capacitor (MIT licence). The full MIT licence text is available at https://opensource.org/licenses/MIT.']
        ]
    },
    contact: {
        title: 'Contact & Support',
        subtitle: 'We read every message',
        body: [
            ['p', 'Bugs, ideas, or general feedback — we\'d love to hear from you.'],
            ['h3', 'Email'],
            ['p', 'support@matchday.app'],
            ['h3', 'Response time'],
            ['p', 'We aim to reply within two business days. If you\'re reporting a crash, please include your device model and iOS version.']
        ]
    }
};

function renderBlock([tag, text]) {
    const escape = (s) => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<${tag}>${escape(text)}</${tag}>`;
}

/**
 * Open the in-app legal reader for a given doc id.
 * Returns false if the id is unknown.
 */
export function openLegalDoc(id) {
    const doc = LEGAL_DOCS[id];
    if (!doc) return false;

    const screen = document.getElementById('legal-screen');
    const titleEl = document.getElementById('legal-title');
    const bodyEl = document.getElementById('legal-body');
    if (!screen || !titleEl || !bodyEl) return false;

    titleEl.textContent = doc.title;
    bodyEl.innerHTML = `
        <p class="legal-subtitle">${doc.subtitle || ''}</p>
        ${doc.body.map(renderBlock).join('')}
    `;
    bodyEl.scrollTop = 0;
    screen.classList.add('active');
    return true;
}

export function closeLegalDoc() {
    const screen = document.getElementById('legal-screen');
    if (screen) screen.classList.remove('active');
}
