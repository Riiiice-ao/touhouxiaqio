(function registerHealthSystem(global) {
  /**
   * 通用血量工具。
   * 这里不依赖物理系统，也不依赖任何 DOM，
   * 只负责为 Boss 或对象池槽位提供统一的扣血与血量比例计算。
   */
  class HealthSystem {
    static resetEntity(entity, maxHealth) {
      entity.maxHealth = maxHealth;
      entity.health = maxHealth;
    }

    static resetPoolSlot(pool, slot, maxHealth) {
      pool.maxHealth[slot] = maxHealth;
      pool.health[slot] = maxHealth;
    }

    static damageEntity(entity, damage) {
      entity.health = Math.max(0, entity.health - damage);
      return entity.health <= 0;
    }

    static damagePoolSlot(pool, slot, damage) {
      pool.health[slot] = Math.max(0, pool.health[slot] - damage);
      return pool.health[slot] <= 0;
    }

    static getRatio(entity) {
      if (!entity.maxHealth) {
        return 0;
      }

      return entity.health / entity.maxHealth;
    }
  }

  global.HealthSystem = HealthSystem;
})(window.XTouhouWeb);
