// mock de expo-constants: o teste escolhe o ambiente em __mock.ambiente
const ExecutionEnvironment = { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' }
const estado = { ambiente: 'standalone' }
const Constants = { get executionEnvironment() { return estado.ambiente } }
module.exports = { __esModule: true, default: Constants, ExecutionEnvironment, __mock: estado }
