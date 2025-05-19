import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEN from '../../../public/locales/en/common.json';
import pipelineEN from '../../../public/locales/en/pipeline.json';
import sourceEN from '../../../public/locales/en/source.json';
import destinationEN from '../../../public/locales/en/destination.json';
import transformEN from '../../../public/locales/en/transform.json';
import statusMessageEN from '../../../public/locales/en/statusMessage.json';
import vaultEN from '../../../public/locales/en/vault.json';

i18n
    .use(initReactI18next)
    .init({
        lng: 'en',
        defaultNS: 'common',
        resources: {
            en: { common: commonEN, pipeline: pipelineEN, source: sourceEN, destination: destinationEN, transform: transformEN, statusMessage: statusMessageEN, vault: vaultEN },
        },
    });

const customRender = (ui: React.ReactElement, options?: import('@testing-library/react').RenderOptions) =>
    render(ui, {
        wrapper: ({ children }) => (
            <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        ),
        ...options
    });

export { customRender as render };