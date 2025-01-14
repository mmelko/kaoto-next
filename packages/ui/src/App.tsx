import { Outlet } from 'react-router-dom';
import { useReload } from './hooks/reload.hook';
import { Shell } from './layout/Shell';
import { LocalStorageSettingsAdapter } from './models/settings/localstorage-settings-adapter';
import {
  CatalogLoaderProvider,
  CatalogTilesProvider,
  EntitiesProvider,
  RuntimeProvider,
  SchemasLoaderProvider,
  SettingsProvider,
  SourceCodeProvider,
  VisibleFlowsProvider,
} from './providers';
import { isDefined } from './utils';
import { CatalogSchemaLoader } from './utils/catalog-schema-loader';

function App() {
  const ReloadProvider = useReload();
  const settingsAdapter = new LocalStorageSettingsAdapter();
  let catalogUrl = CatalogSchemaLoader.DEFAULT_CATALOG_PATH;
  const settingsCatalogUrl = settingsAdapter.getSettings().catalogUrl;

  if (isDefined(settingsCatalogUrl) && settingsCatalogUrl !== '') {
    catalogUrl = settingsCatalogUrl;
  }

  return (
    <ReloadProvider>
      <SettingsProvider adapter={settingsAdapter}>
        <SourceCodeProvider>
          <RuntimeProvider catalogUrl={catalogUrl}>
            <SchemasLoaderProvider>
              <CatalogLoaderProvider>
                <EntitiesProvider>
                  <Shell>
                    <CatalogTilesProvider>
                      <VisibleFlowsProvider>
                        <Outlet />
                      </VisibleFlowsProvider>
                    </CatalogTilesProvider>
                  </Shell>
                </EntitiesProvider>
              </CatalogLoaderProvider>
            </SchemasLoaderProvider>
          </RuntimeProvider>
        </SourceCodeProvider>
      </SettingsProvider>
    </ReloadProvider>
  );
}

export default App;
