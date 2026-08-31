import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const page = (name) => resolve(__dirname, name, 'index.html');
const pageLoaderPlugin = {
  name: 'creative-creatures-page-loader',
  transformIndexHtml() {
    return [
      { tag: 'link', attrs: { rel: 'stylesheet', href: '/shared/page-loader.css' }, injectTo: 'head' },
      {
        tag: 'div',
        attrs: { id: 'ccPageLoader', role: 'status', 'aria-live': 'polite', 'aria-hidden': 'false' },
        children: '<div class="cc-loader-card"><div class="cc-loader-mark"><span class="cc-loader-orbit"></span><img src="/favicon.svg" alt=""></div><div class="cc-loader-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="cc-loader-copy"><strong>Creative Creatures</strong><span data-loader-copy>Loading your agency workspace…</span></div></div>',
        injectTo: 'body-prepend'
      },
      { tag: 'script', attrs: { src: '/shared/page-loader.js' }, injectTo: 'body-prepend' }
    ];
  }
};


export default defineConfig({
  plugins: [react(), tailwindcss(), pageLoaderPlugin],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        login: page('login'),
        signIn: page('sign-in'),
        admin: page('admin'),
        adminLogin: resolve(__dirname, 'admin', 'login', 'index.html'),
        adminOwnerArchetypes: resolve(__dirname, 'admin', 'owner-archetypes', 'index.html'),
        adminScorecards: resolve(__dirname, 'admin', 'scorecards', 'index.html'),
        adminPerformance: resolve(__dirname, 'admin', 'performance', 'index.html'),
        platform: page('platform'),
        leadership: page('leadership'),
        marketing: page('marketing'),
        sales: page('sales'),
        billing: page('billing'),
        onboarding: page('onboarding'),
        serviceDelivery: page('service-delivery'),
        clientSuccess: page('client-success'),
        talentAcquisition: page('talent-acquisition'),
        finance: page('finance'),
        communication: page('communication'),
        systems: page('systems'),
        sops: page('sops'),
        users: page('users'),
        diagnostic: page('diagnostic'),
        diagnosticProcessing: resolve(__dirname, 'diagnostic', 'processing', 'index.html'),
        accelerator: page('accelerator'),
        signup: page('signup'),
        signupLookup: resolve(__dirname, 'signup', 'lookup', 'index.html'),
        payment: page('payment'),
        ownerArchetype: page('owner-archetype'),
        agencyScorecard: page('agency-scorecard'),
        performanceReport: resolve(__dirname, 'agency-scorecard', 'performance', 'index.html'),
        strengthReport: resolve(__dirname, 'agency-scorecard', 'strength', 'index.html'),
        independenceReport: resolve(__dirname, 'agency-scorecard', 'independence', 'index.html'),
        artifacts: page('artifacts'),
        agencyGoals: page('agency-goals'),
        integrationInformation: page('integration-information'),
        integrations: page('integrations'),
        quickbooksCallback: resolve(__dirname, 'integrations', 'quickbooks', 'callback', 'index.html'),
        freshbooksCallback: resolve(__dirname, 'integrations', 'freshbooks', 'callback', 'index.html'),
        googleCalendarCallback: resolve(__dirname, 'integrations', 'google-calendar', 'callback', 'index.html'),
        googleDriveCallback: resolve(__dirname, 'integrations', 'google-drive', 'callback', 'index.html'),
        googleChatCallback: resolve(__dirname, 'integrations', 'google-chat', 'callback', 'index.html'),
        hubspotCallback: resolve(__dirname, 'integrations', 'hubspot', 'callback', 'index.html'),
        zohoCrmCallback: resolve(__dirname, 'integrations', 'zoho-crm', 'callback', 'index.html'),
        slackCallback: resolve(__dirname, 'integrations', 'slack', 'callback', 'index.html'),
        clickupCallback: resolve(__dirname, 'integrations', 'clickup', 'callback', 'index.html'),
        teamworkCallback: resolve(__dirname, 'integrations', 'teamwork', 'callback', 'index.html'),
        mondayCallback: resolve(__dirname, 'integrations', 'monday', 'callback', 'index.html'),
        jiraCallback: resolve(__dirname, 'integrations', 'jira', 'callback', 'index.html'),
        zoomCallback: resolve(__dirname, 'integrations', 'zoom', 'callback', 'index.html'),
        independenceIndex: page('independence-index'),
        agencyStrengthIndex: page('agency-strength-index'),
        agencyPerformanceIndex: page('agency-performance-index'),
      },
    },
  },
});
