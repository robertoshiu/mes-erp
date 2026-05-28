import { generateEquipment } from './equipment'
import { generateProducts } from './products'
import { generateCustomers } from './customers'
import { generateOperators } from './operators'
import { generateRoutes } from './routes'
import { generateRecipes } from './recipes'
import { generateLots } from '../lots'

export function generateMasterData() {
  const equipment = generateEquipment(42)
  const products = generateProducts(100)
  const customers = generateCustomers()
  const routes = generateRoutes()
  const toolIds = equipment.map(e => e.toolId)
  const operators = generateOperators(200, toolIds)
  const recipes = generateRecipes(300)
  const lots = generateLots(400, 200, products, customers, routes, toolIds)

  return { equipment, products, customers, routes, operators, recipes, lots }
}

export type MasterData = ReturnType<typeof generateMasterData>
