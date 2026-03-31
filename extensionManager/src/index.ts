import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { PageConfig } from '@jupyterlab/coreutils';
/**
 * Initialization data for the extensionmanager extension.
 */

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'extensionmanager:plugin',
  description: 'Extension which adds the baseurl to the configuration and manages the on/off status of our ai support extensions',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const hubPrefix = PageConfig.getOption("hubPrefix");
    const hubBaseUrl = window.location.origin + hubPrefix.replace(/\/hub\/?$/, '');
    PageConfig.setOption("JupyterHubBaseUrl", hubBaseUrl);
    const JupyterHubBaseUrl = PageConfig.getOption("JupyterHubBaseUrl");

    console.log('[extensionManager] hubPrefix:', JSON.stringify(hubPrefix));
    console.log('[extensionManager] baseUrl:', PageConfig.getBaseUrl());
    console.log('[extensionManager] resolved JupyterHubBaseUrl:', JupyterHubBaseUrl);

  async function getUserSupportGroup(): Promise<string> {

    let token = PageConfig.getToken();
    const UserSupportGroupEndpoint = JupyterHubBaseUrl+'/services/askLLM/userSupportGroup';

    try{
      const response = await fetch(UserSupportGroupEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.designatedSupportGroup
    } catch (error) {
      console.error('Failed to fetch support group:', error);
      return 'noSupport';
    }
  }
  
  
  (async () => {
    try {
      const supportGroup = await getUserSupportGroup();
      window.sessionStorage.setItem('UseExtension', supportGroup);
    } catch (error) {
      console.error('Error setting support group:', error);
      window.sessionStorage.setItem('UseExtension', 'noSupport');
    }
  })();  
  }
};

export default plugin;
