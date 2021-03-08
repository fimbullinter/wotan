# Working with the API

This document explains the basic concepts of using and customizing the API.
The API is designed for dependency injection using [`inversify`](https://github.com/inversify/InversifyJS).

## Services

There are several core services that are provided by Wotan through the ContainerModule created by calling `createCoreModule(globalOptions)`. These services are not meant to be overridden.

* `CachedFileSystem` is a wrapper for the low level `FileSystem` service, which caches the file system layout. File contents are not cached.
* `ConfigurationManager` is the place for everything related to configuration handling. Internally it uses `ConfigurationProvider` to find, load and parse configuration files. Parsed configuration files are cached.
* `DependencyResolverFactory` creates a service to determine how files in the program affect each other.
* `FormatterLoader` loads core and custom formatters via `FormatterLoaderHost`.
* `Linter` executes a given set of rules on a SourceFile. It automatically loads enabled rules using `RuleLoader` and filters out disabled findings using `FindingFilterFactory`. `Linter` can also automatically fix findings and return the fixed source code. It does not access the file system.
* `ProcessorLoader` loads and caches processors using `Resolver`.
* `ProgramStateFactory` creates a service to get lint results for up-to-date files from cache and update the cache as necessary. Uses `StatePersistence` to load the cache for the current project. Uses `DependencyResolverFactory` to find out about file dependencies. `ContentId` is used to detect changes to files without storing the whole file content in cache.
* `RuleLoader` loads and caches core and custom rules via `RuleLoaderHost`.
* `Runner` is used to lint a collection of files. If you want to lint a project, you provide the path of one or more `tsconfig.json` and it creates the project internally. `Runner` loads the source code from the file system, loads configuration from `ConfigurationManager`, applies processors if specified in the configuration and lints all (matching) files using `Linter`. It uses `FileFilterFactory` to filter out non-user code. If caching is enabled, it uses `ProgramStateFactory` to load the cached results and update the cache.

These core services use other abstractions for the low level tasks. That enables you to change the behavior of certain services without the need to implement the whole thing.
The default implementations (targeting the Node.js runtime environment) are provided throug the ContainerModule `DEFAULT_DI_MODULE`. The default implementation is only used if there is no binding for the identifier.

* `BuiltinResolver` (`DefaultBuiltinResolver`) resolves the path to core rules, formatters and configs in `@fimbul/mimir`.
* `CacheFactory` (`DefaultCacheFactory`) is responsible for creating cache objects that are used by other services to store their data.
* `ConfigurationProvider` (`DefaultConfigurationProvider`) is responsible to find, resolve and load configuration files.
* `ContentId` (`ContentHasher`) computes an ID representing the file's content (typically a hash).
* `DeprecationHandler` (`DefaultDeprecationHandler`) is notified everytime a deprecated rule, formatter of processor is used. This service can choose to inform the user or just swallow the event.
* `DirectoryService` (`NodeDirectoryService`) provides the current directory. None of the builtin services cache the current directory. Therefore you can change it dynamically if you need to.
* `FileFilterFactory` (`DefaultFileFilterFactory`) creates a `FileFilter` for a given Program, that is responsible for filtering out non-user code. By default it excludes `lib.xxx.d.ts`, `@types`, declaration and javascript files of imported modules, json files and declaration files of project references.
* `FileSystem` (`NodeFileSystem`) is responsible for the low level file system access. By providing this service, you can use an in-memory file system for example. Every file system access (except for the globbing) goes through this service.
* `FormatterLoaderHost` (`NodeFormatterLoader`) is used to resolve and require a formatter.
* `FindingFilterFactory` (`LineSwitchFilterFactory`) creates a `FindingFilter` for a given SourceFile to determine if a finding is disabled. The default implementation parses `// wotan-disable` comments to filter findings by rulename. Your custom implementation can choose to filter by different criteria, e.g. matching the finding message.
  * `LineSwitchParser` (`DefaultLineSwitchParser`) is used by `LineSwitchFilterFactory` to parse the line and rulename based disable comments from the source code. A custom implementation could use a different comment format, for example `// ! package/*` and return the appropriate switch positions.
* `MessageHandler` is used for user facing messages. `log` is called for the result of a command, `warn` is called everytime a warning event occurs and `error` is used to display exception messages.
* `Resolver` (`NodeResolver`) is an abstraction for `require()` and `require.resolve()`. It's used to locate and load external resources (configuration, scripts, ...).
* `RuleLoaderHost` (`NodeRuleLoader`) is used to resolve and require a rule.
* `StatePersistence` (`DefaultStatePersistence`) is responsible to load and save the cache for a given `tsconfig.json`.

## Example

The example below creates a new DI-Container and binds all necessary services. Afterwards it uses `ConfigurationManager` to find and reduce the configuration for each SourceFile. The configuration and the SourceFile are then passed to `Linter` to do get a list of findings for that file.

```ts
import { Container, BindingScopeEnum, injectable } from 'inversify';
import { createDefaultModule, createCoreModule, ConfigurationManager, Linter, FileSystem, NodeFileSystem } from '@fimbul/wotan';
import * as ts from 'typescript';

// using RequestScope makes sure there is only one instance of each service and therefore only one cache
const container = new Container({defaultScope: BindingScopeEnum.Request});
// bind your own services here:
// let's assume you have a custom file system implementation and want to replace the default
declare class MyFileSystem extends NodeFileSystem {}
container.bind(FileSystem).to(MyFileSystem);

// load all core services and all default service implementations that are not already bound
container.load(createCoreModule({}), createDefaultModule());

@injectable()
class ApiUser {
    constructor(private linter: Linter, private configurationManager: ConfigurationManager) {}

    public lint(program: ts.Program) {
        for (const file of program.getSourceFiles()) {
            const config = this.configurationManager.find(file.fileName);
            if (config === undefined) {
                // no config found
                continue;
            }
            const effectiveConfig = this.configurationManager.reduce(config, file.fileName);
            if (effectiveConfig === undefined) {
                // this file is excluded from linting
                continue;
            }
            const result = this.linter.lintFile(file, effectiveConfig, program);
            // do something with the lint findings
        }
    }
}

container.bind(ApiUser).toSelf();

// create a new instance of your class with all dependencies resolved and injected
const apiUser = container.get(ApiUser);

// let's assume you already have a ts.Program
declare let program: ts.Program;
apiUser.lint(program);
```

Note that in the above example the cache is never cleared. There are several reasons to clear the cache. For example you suspect there might be a change to the configuration file.
In that case you just need to create a new instance of `ApiUser`. That creates new instances of each service with a clean cache.

## Required `compilerOptions`

To compile the above example or anything else that uses the API you need *at least* the following compilerOptions:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "es2015"
  }
}
```

`experimentalDecorators` and `emitDecoratorMetadata` is required for the `@injectable()` decorator to work properly.
`target` should be at least ES2015 (aka ES6) to have support for native classes. Otherwise you'll have a problem if you want to extend one of the classes exposed as public API.
If you want, you can set `"lib": ["es2016"]` to make the types of `Array.prototype.includes` available.

Because Wotan only supports node.js >= 6 you can be sure that all ES2015 and ES2016 features are available.
