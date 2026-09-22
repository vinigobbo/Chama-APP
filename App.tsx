import { useState, useEffect } from 'react'
import { View, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useFonts } from 'expo-font'
import { Ionicons } from '@expo/vector-icons'

import { cores } from './src/theme/colors'
import { fontes } from './src/theme/fonts'
import { abrirBanco } from './src/db/database'

import HojeScreen from './src/screens/HojeScreen'
import MetasScreen from './src/screens/MetasScreen'
import AcademiaScreen from './src/screens/AcademiaScreen'
import ConfigScreen from './src/screens/ConfigScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const tema = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: cores.acento,
    background: cores.fundo,
    card: cores.fundo,
    text: cores.texto,
    border: 'transparent',
  },
}

const cabecalho = {
  headerStyle: { backgroundColor: cores.fundo },
  headerTintColor: cores.texto,
  headerTitleStyle: { color: cores.texto, fontFamily: fontes.corpo },
  headerShadowVisible: false,
}

function Abas() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        ...cabecalho,
        headerTitle: '',
        headerRight: () => (
          <TouchableOpacity style={styles.engrenagem} onPress={() => navigation.navigate('Config')}>
            <Ionicons name="settings-outline" size={22} color={cores.texto} />
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: cores.fundo,
          borderTopColor: cores.fundoInput,
          height: 60,
        },
        tabBarActiveTintColor: cores.acento,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarIcon: ({ color, size }) => {
          const icones: Record<string, any> = {
            Hoje: 'today-outline',
            Metas: 'flag-outline',
            Academia: 'barbell-outline',
          }
          return <Ionicons name={icones[route.name]} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Hoje" component={HojeScreen} />
      <Tab.Screen name="Metas" component={MetasScreen} />
      <Tab.Screen name="Academia" component={AcademiaScreen} />
    </Tab.Navigator>
  )
}

export default function App() {
  const [bancoPronto, setBancoPronto] = useState(false)

  const [fontesCarregadas] = useFonts({
    'Inter': require('./assets/fonts/Inter_28pt-Regular.ttf'),
    'JetBrains Mono': require('./assets/fonts/JetBrainsMono-Regular.ttf'),
  })

  useEffect(() => {
    async function iniciar() {
      await abrirBanco()
      setBancoPronto(true)
    }
    iniciar()
  }, [])

  if (!fontesCarregadas || !bancoPronto) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={cores.acento} size="large" />
      </View>
    )
  }

  return (
    <NavigationContainer theme={tema}>
      <Stack.Navigator screenOptions={{ ...cabecalho, contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Screen name="Abas" component={Abas} options={{ headerShown: false }} />
        <Stack.Screen name="Config" component={ConfigScreen} options={{ title: 'configurações' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: cores.fundo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  engrenagem: { paddingHorizontal: 16, paddingVertical: 8 },
})
