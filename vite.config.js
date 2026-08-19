import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const page = (name) => resolve(__dirname, name, 'index.html');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        login: page('login'),
        signIn: page('sign-in'),
        admin: page('admin'),
        adminLogin: resolve(__dirname, 'admin', 'login', 'index.html'),
        adminOwnerArchetypes: resolve(__dirname, 'admin', 'owner-archetypes', 'index.html'),
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
        integrations: page('integrations'),
        quickbooksCallback: resolve(__dirname, 'integrations', 'quickbooks', 'callback', 'index.html'),
        independenceIndex: page('independence-index'),
        agencyStrengthIndex: page('agency-strength-index'),
        agencyPerformanceIndex: page('agency-performance-index'),
      },
    },
  },
});
